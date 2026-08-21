// Slice 1: 最薄录制引擎。每帧 exportToCanvas(exportingFrame) → drawImage 到合成器
// canvas → captureStream(fps) → MediaRecorder → blob。无摄像头/麦克/指针/持久化。
// 详见 .scratch/recording/issues/01-record-end-to-end.md
//
// 关键事实(来自 Slice 0 spike):await exportToCanvas(...) 直接返回 HTMLCanvasElement。

import { exportToCanvas } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawFrameElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { getCanvasId } from "../app_constants";

import type { PointerSlidePos } from "./pointer-to-slide";

export type RecorderState = "idle" | "recording" | "stopping" | "error";

export interface RecorderHandle {
  stop: () => Promise<Blob>;
}

/** 摄像头合成参数(每帧读取,支持录制中拖拽/切换)。 */
export interface CameraOpts {
  enabled: boolean;
  getVideoEl: () => HTMLVideoElement | null;
  shape: "circle" | "square";
  /** 占 slide 宽度百分比(8–30)。 */
  sizePct: number;
  /** 气泡中心,归一化 0..1(slide 宽)。 */
  x: number;
  /** 气泡中心,归一化 0..1(slide 高)。 */
  y: number;
}

/** 录制指针参数(每帧读取;仅在 pos 落入 slide 边界时绘制)。 */
export interface PointerOpts {
  enabled: boolean;
  pos: PointerSlidePos | null;
}

/**
 * 画录制指针:外层柔光晕 + 实心红圆。半径按合成器宽度比例(分辨率无关)。
 */
const drawPointer = (
  ctx: CanvasRenderingContext2D,
  pos: PointerSlidePos,
  w: number,
) => {
  const r = Math.max(8, w * 0.008);
  const glowR = r * 3.2;
  const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
  grad.addColorStop(0, "rgba(224, 49, 49, 0.45)");
  grad.addColorStop(1, "rgba(224, 49, 49, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e03131";
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * 把摄像头帧画到合成器:中心方裁 → 圆/方遮罩 → 细白环。
 * 位置/尺寸用 slide 归一化坐标(与编辑器 overlay 同源)。
 */
const drawCameraBubble = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  cam: CameraOpts,
  w: number,
  h: number,
) => {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return;
  }
  const size = (cam.sizePct / 100) * w;
  const cx = cam.x * w;
  const cy = cam.y * h;
  // 源中心方裁(webcam 多 16:9 → 取中心正方形)
  const sSize = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - sSize) / 2;
  const sy = (video.videoHeight - sSize) / 2;

  ctx.save();
  ctx.beginPath();
  if (cam.shape === "circle") {
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  } else {
    ctx.rect(cx - size / 2, cy - size / 2, size, size);
  }
  ctx.clip();
  // 水平镜像:与编辑器 overlay 的 selfie 镜像一致(预览举手方向 = 成片方向)
  ctx.translate(2 * cx, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(
    video,
    sx,
    sy,
    sSize,
    sSize,
    cx - size / 2,
    cy - size / 2,
    size,
    size,
  );
  ctx.restore();

  // 细白环:任何背景上都看得清
  ctx.lineWidth = Math.max(2, size * 0.02);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.beginPath();
  if (cam.shape === "circle") {
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  } else {
    ctx.rect(cx - size / 2, cy - size / 2, size, size);
  }
  ctx.stroke();
};

export interface StartRecorderOpts {
  excalidrawAPI: ExcalidrawImperativeAPI;
  /** 当前聚焦的 slide(每帧读取,随导航跟随)。无则抛错。 */
  getFrame: () => ExcalidrawFrameElement | null;
  /** 摄像头合成参数(每帧读取,支持录制中拖拽/切换)。null/未启用则不画。 */
  getCamera?: () => CameraOpts | null;
  /** 麦克风音频流(其音轨并入 MediaRecorder;停止时释放)。null/未启用则静默视频。 */
  audioStream?: MediaStream | null;
  /** 录制指针(每帧读取;仅在 pos 落入 slide 边界时绘制)。 */
  getPointer?: () => PointerOpts | null;
  fps?: number;
  onStateChange?: (state: RecorderState) => void;
}

/** 浏览器是否具备录制能力(MediaRecorder + getUserMedia + canvas.captureStream)。 */
export const supportsRecording = (): boolean =>
  typeof MediaRecorder !== "undefined" &&
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === "function" &&
  typeof HTMLCanvasElement !== "undefined" &&
  typeof HTMLCanvasElement.prototype.captureStream === "function";

/** 选可用的视频(+音频)mime;优先 MP4/H.264(全平台兼容),回退 WebM/VP9。 */
const pickMimeType = (): string => {
  const candidates = [
    // MP4/H.264:分享/上传/任意播放器通用(Chrome/Edge/Safari 支持)
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    // WebM/VP9:Firefox 等仅支持;开源、体积更小
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "";
};

/** mime → 文件扩展名(mp4 系 → .mp4,其余 → .webm)。 */
export const mimeToExt = (mime: string): string =>
  mime.startsWith("video/mp4") ? ".mp4" : ".webm";

type CanvasCaptureStream = HTMLCanvasElement & {
  captureStream(fps?: number): MediaStream;
};

/**
 * 启动录制:合成器 canvas = 当前聚焦 slide 的目标分辨率。rAF 循环每帧把
 * exportToCanvas 的结果 drawImage 上去;captureStream + MediaRecorder 编码。
 */
export const startRecorder = ({
  excalidrawAPI,
  getFrame,
  getCamera,
  audioStream,
  getPointer,
  fps = 30,
  onStateChange,
}: StartRecorderOpts): RecorderHandle => {
  const firstFrame = getFrame();
  if (!firstFrame) {
    throw new Error("[recorder] 没有聚焦的 slide,无法录制");
  }
  // 诊断:打印实际使用的背景色 + 尺寸(排查"导出背景色不对")
  // eslint-disable-next-line no-console
  console.log("[recorder] start", {
    size: [firstFrame.width, firstFrame.height],
    background: excalidrawAPI.getAppState().viewBackgroundColor,
    exportWithDarkMode: excalidrawAPI.getAppState().exportWithDarkMode,
  });

  const compositor = document.createElement("canvas");
  compositor.width = firstFrame.width;
  compositor.height = firstFrame.height;
  // 附到 DOM(offscreen):部分真实浏览器对脱离 DOM 的 canvas 的 captureStream
  // 会产空帧(Playwright/Chromium 偏宽松测不出),附 DOM 保证可靠捕获。
  compositor.style.cssText =
    "position:fixed;left:-99999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(compositor);
  const ctx = compositor.getContext("2d");
  if (!ctx) {
    compositor.remove();
    throw new Error("[recorder] 合成器 2d context 不可用");
  }

  const stream = (compositor as CanvasCaptureStream).captureStream(fps);
  audioStream?.getAudioTracks().forEach((t) => stream.addTrack(t));
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };
  recorder.start(1000); // timeslice 1s:增量产出 chunk,降低长录内存峰值

  let stopped = false;
  let rendering = false;
  let raf = 0;
  let drawnCount = 0;

  // 录制中途致命错误(媒体服务/编解码器/轨道结束):停循环 + 清理 + 上报。
  // 不停 → rAF 持续 ~60fps 跑 exportToCanvas(CPU 泄漏)+ compositor 残留 DOM。
  let recordingError: Error | null = null;
  recorder.onerror = (e: Event) => {
    recordingError =
      (e as unknown as { error?: Error }).error ??
      new Error("[recorder] MediaRecorder 录制中错误");
    stopped = true;
    cancelAnimationFrame(raf);
    compositor.remove();
    onStateChange?.("error");
  };

  const renderFrame = async () => {
    const frame = getFrame();
    if (!frame) {
      return;
    }
    let canvas: HTMLCanvasElement;
    try {
      canvas = (await exportToCanvas({
        elements: excalidrawAPI.getSceneElements(),
        appState: { ...excalidrawAPI.getAppState(), exportBackground: true },
        files: excalidrawAPI.getFiles(),
        exportingFrame:
          frame as unknown as NonDeleted<ExcalidrawFrameLikeElement>,
      })) as unknown as HTMLCanvasElement;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[recorder] exportToCanvas 失败,跳过该帧", e);
      return;
    }
    if (stopped) {
      return;
    }
    // slide 尺寸变化(理论上 config 统一尺寸,这里防御性清屏)
    if (
      compositor.width !== frame.width ||
      compositor.height !== frame.height
    ) {
      compositor.width = frame.width;
      compositor.height = frame.height;
    }
    ctx.clearRect(0, 0, compositor.width, compositor.height);
    ctx.drawImage(canvas, 0, 0);
    drawnCount += 1;
    const cam = getCamera?.();
    if (cam?.enabled) {
      const v = cam.getVideoEl();
      if (v) {
        drawCameraBubble(ctx, v, cam, compositor.width, compositor.height);
      }
    }
    const ptr = getPointer?.();
    if (ptr?.enabled && ptr.pos?.inBounds) {
      drawPointer(ctx, ptr.pos, compositor.width);
    }
  };

  const loop = () => {
    if (stopped) {
      return;
    }
    if (!rendering) {
      rendering = true;
      void renderFrame().finally(() => {
        rendering = false;
      });
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  onStateChange?.("recording");

  const stop = () =>
    new Promise<Blob>((resolve, reject) => {
      if (stopped) {
        reject(new Error("[recorder] 已停止"));
        return;
      }
      stopped = true;
      cancelAnimationFrame(raf);
      // 录制中途已出错:recorder 多半已 inactive,直接 reject(不再 .stop() 免抛 InvalidState)
      if (recordingError) {
        compositor.remove();
        onStateChange?.("error");
        reject(recordingError);
        return;
      }
      onStateChange?.("stopping");
      recorder.onstop = () => {
        // 音轨由调用方(SlidesPanel mic effect)管理生命周期,此处不 stop。
        compositor.remove();
        if (drawnCount === 0) {
          // eslint-disable-next-line no-console
          console.warn(
            "[recorder] 0 帧绘制 → 录制为空(查 exportToCanvas 是否报错 / canvas 捕获)",
          );
        }
        onStateChange?.("idle");
        resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
      };
      recorder.stop();
    });

  return { stop };
};

/** 触发浏览器下载(blob → <a download> → click)。 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** `<画布id>-<时间戳><ext>`,ext 跟随实际录制格式(.mp4/.webm)。 */
export const recordingFilename = (ext = ".webm"): string => {
  const canvasId = getCanvasId();
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${canvasId}-${ts}${ext}`;
};
