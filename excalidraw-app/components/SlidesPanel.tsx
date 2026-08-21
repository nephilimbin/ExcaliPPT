// 幻灯片竖面板(右侧常驻,垂直居中)。
// 顶部标题「幻灯片设置」→ 折叠 / 设置(参数 popover)/ 加号 → slide 列表
// (点击聚焦 / 拖拽换序 / 右上角红色 × 删除)。按钮统一用 Excalidraw IconButton(ToolIcon 样式)。

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaptureUpdateAction, useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";
import { preventUnload } from "@excalidraw/common";
import {
  CloseIcon,
  PlusIcon,
  chevronRight,
  settingsIcon,
  sidebarRightIcon,
} from "@excalidraw/excalidraw/components/icons";
import { Button } from "@excalidraw/excalidraw/components/Button";
import { IconButton } from "@excalidraw/excalidraw/components/IconButton";
import { Island } from "@excalidraw/excalidraw/components/Island";
import { newElementWith, syncInvalidIndices } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
} from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import {
  findPreset,
  getAllPresets,
  heightFromWidth,
  widthFromHeight,
  type AspectPreset,
} from "../slides/aspect-preset";
import {
  DEFAULT_CONFIG,
  getEffectiveConfig,
  loadCustomPresets,
  saveCanvasConfig,
  saveDefaultConfig,
  type SlideConfig,
} from "../slides/slide-config";
import {
  createSlides,
  slideCenterAt,
  type Point,
  type SlideLayout,
} from "../slides/slide-factory";
import { getSlides } from "../slides/slide-list";
import { softDeleteFrame } from "../slides/slide-delete";
import { reorderFrames } from "../slides/slide-reorder";
import { computeFocus, DEFAULT_TOP_PADDING } from "../slides/slide-navigation";
import {
  requestTeleprompterPiP,
  supportsDocumentPiP,
} from "../teleprompter/teleprompter-pip";
import {
  loadSettings,
  updateSettings,
} from "../teleprompter/teleprompter-storage";

import {
  downloadBlob,
  mimeToExt,
  recordingFilename,
  startRecorder,
  supportsRecording,
  type RecorderHandle,
} from "../recording/recorder";
import {
  getEffectiveRecordingConfig,
  saveCanvasRecordingConfig,
  type RecordingConfig,
} from "../recording/recording-config";
import { CameraBubble, type FrameScreen } from "../recording/CameraBubble";
import {
  hasDeviceLabels,
  listAudioInputs,
  listVideoInputs,
  type MediaDevice,
} from "../recording/device-list";
import { screenToSlide } from "../recording/pointer-to-slide";

import { Teleprompter } from "./Teleprompter";

import "./SlidesPanel.scss";

/** 靶心图标:用于「中心锚点」开关。 */
const TargetIcon = (
  <svg viewBox="0 0 1024 1024" fill="currentColor">
    <path d="M991.524094 479.528025h-29.8706c-2.097935 0-3.796264-1.598427-3.996066-3.696361C940.374438 256.747297 765.346709 82.019273 546.162441 65.235792c-2.097935-0.199803-3.696362-1.898132-3.696362-3.996067V33.167355C542.466079 15.484759 527.980336 0.59941 510.397642 0.999017c-17.083186 0.299705-30.869617 14.285939-30.869617 31.469026v28.871584c0 2.097935-1.598427 3.796264-3.696361 3.996066-218.784662 17.282989-393.212981 191.711309-410.495971 410.495971-0.199803 2.097935-1.898132 3.696362-3.996066 3.696361H31.469027C14.086136 479.528025 0 493.614161 0 510.997052v0.899115C0 529.37896 14.086136 543.465096 31.469027 543.465096h29.8706c2.097935 0 3.796264 1.598427 3.996066 3.696361 17.282989 218.784662 191.711309 393.212981 410.495971 410.495971 2.097935 0.199803 3.696362 1.898132 3.696361 3.996066v30.170305c0 17.682596 14.485742 32.567945 32.068437 32.168339 17.083186-0.299705 30.869617-14.285939 30.869617-31.469027v-30.869617c0-2.097935 1.598427-3.796264 3.696362-3.996066 219.184268-16.783481 394.211998-191.511505 411.494987-410.595872 0.199803-2.097935 1.898132-3.696362 3.996066-3.696362h29.8706c17.382891 0 31.469027-14.086136 31.469027-31.469027v-0.899115c0-17.382891-14.086136-31.469027-31.469027-31.469027z m-860.4531-17.9823c4.395674-34.166372 13.386824-67.433629 26.873549-99.302262 19.281023-45.655064 46.953786-86.714651 82.219076-121.979942s76.324877-62.938053 121.979942-82.219076c31.868633-13.486726 65.13589-22.477876 99.302262-26.87355 9.590561-1.19882 18.082203 6.193904 18.082202 15.884366 0 3.996067-1.498525 7.692429-3.896165 10.489676-2.497542 2.797247-5.894199 4.79528-9.890265 5.294788C308.096756 183.319568 183.319568 308.096756 162.839725 465.641693c-0.999017 7.892232-7.79233 13.886332-15.884366 13.886332-8.891249 0-15.984268-7.292822-15.984267-15.984267 0-0.699312 0-1.398623 0.099902-1.998033zM463.543758 892.022029c-0.699312 0-1.398623 0-2.097935-0.099902-34.166372-4.395674-67.433629-13.386824-99.302262-26.873549-45.655064-19.281023-86.714651-46.953786-121.979942-82.219076s-62.938053-76.324877-82.219076-121.979942c-13.486726-31.868633-22.477876-65.13589-26.873549-99.302262-1.19882-9.590561 6.193904-17.982301 15.884365-17.982301 3.996067 0 7.692429 1.498525 10.489676 3.996067s4.79528 5.894199 5.294789 9.890266c20.579744 157.445035 145.356933 282.222223 302.901869 302.702066 7.992134 0.999017 13.886332 7.892232 13.886332 15.884366 0 8.891249-7.292822 15.984268-15.984267 15.984267zM511.596462 672.338252c-17.682596-0.399607-32.068437 14.485742-32.068437 32.168339v74.526647c0 9.990167-9.091052 17.482793-18.881416 15.684563-20.979351-3.696362-41.359292-9.790364-61.139823-18.082203-34.266273-14.485742-65.035988-35.26529-91.509931-61.639332-26.473943-26.473943-47.153589-57.243658-61.639332-91.509931-8.39174-19.780531-14.385841-40.160472-18.182104-61.139823-1.79823-9.790364 5.694395-18.881416 15.684562-18.881416h76.224976c17.382891 0 31.469027-14.086136 31.469027-31.469027v-0.899115c0-17.382891-14.086136-31.469027-31.469027-31.469027h-76.224976c-9.990167 0-17.482793-9.091052-15.684562-18.881416 3.696362-20.979351 9.790364-41.359292 18.182104-61.139823 14.485742-34.266273 35.26529-65.035988 61.639332-91.509932 26.473943-26.473943 57.243658-47.153589 91.509931-61.639331 19.780531-8.39174 40.160472-14.385841 61.139823-18.182105 9.790364-1.79823 18.881416 5.694395 18.881416 15.684563v76.524681c0 17.682596 14.485742 32.567945 32.068437 32.168338 17.083186-0.299705 30.869617-14.285939 30.869617-31.469027V243.76008c0-9.990167 8.99115-17.382891 18.881416-15.684563 21.279056 3.696362 42.058604 9.790364 62.13884 18.282006 34.266273 14.485742 65.035988 35.26529 91.509931 61.639332 26.473943 26.473943 47.153589 57.243658 61.639332 91.509931 8.39174 19.780531 14.385841 40.160472 18.082203 61.139823 1.79823 9.790364-5.694395 18.881416-15.684563 18.881416h-76.224976c-17.382891 0-31.469027 14.086136-31.469026 31.469027v0.899115c0 17.382891 14.086136 31.469027 31.469026 31.469027h76.224976c9.990167 0 17.482793 9.091052 15.684563 18.881416-3.696362 20.979351-9.790364 41.359292-18.082203 61.139823-14.485742 34.266273-35.26529 65.035988-61.639332 91.509932-26.473943 26.473943-57.243658 47.153589-91.509931 61.639331-20.080236 8.491642-40.859784 14.585644-62.13884 18.282006C551.457229 796.615932 542.466079 789.223209 542.466079 779.233041v-75.425762c0-17.183088-13.686529-31.169322-30.869617-31.469027z m380.325665-110.890856c-4.395674 34.166372-13.386824 67.433629-26.873549 99.302262-19.281023 45.655064-46.953786 86.714651-82.219076 121.979942s-76.324877 62.938053-121.979942 82.219076c-32.168338 13.586627-65.835202 22.67768-100.301279 27.073353-9.590561 1.19882-17.982301-6.293805-17.982301-15.884366 0-3.996067 1.498525-7.692429 3.996067-10.589577 2.497542-2.797247 5.9941-4.79528 9.890266-5.294789C714.396856 840.173061 839.673553 715.19607 860.153396 557.251526c0.999017-7.892232 7.892232-13.786431 15.884366-13.78643 8.891249 0 15.984268 7.292822 15.984267 15.984267 0 0.699312 0 1.298722-0.099902 1.998033z m1.79823-81.919371h-31.968535c-14.885349-164.33825-142.759489-296.108556-305.399411-316.788201-7.992134-0.999017-13.886332-7.79233-13.886332-15.884366 0-8.891249 7.292822-15.984268 15.984267-15.984268 0.699312 0 1.398623 0 1.998034 0.099902 34.565979 4.395674 68.13294 13.386824 100.301278 27.073353 45.655064 19.281023 86.714651 46.953786 121.979942 82.219076s62.938053 76.324877 82.219076 121.979942c15.884366 37.363225 25.574828 76.724484 28.771681 117.284562 0.099902 0 0.099902 0 0 0z" />
    <path d="M511.496561 511.496561m-111.889873 0a111.889873 111.889873 0 1 0 223.779745 0 111.889873 111.889873 0 1 0-223.779745 0Z" />
  </svg>
);

/** 提词器图标:显示器 + 播放三角(开画中画小窗)。 */
const PrompterIcon = (
  <svg viewBox="0 0 1024 1024" fill="currentColor">
    <path d="M128 128h768a32 32 0 0 1 32 32v480a32 32 0 0 1-32 32H128a32 32 0 0 1-32-32V160a32 32 0 0 1 32-32z m32 64v416h704V192H160z" />
    <path d="M512 384l120 80-120 80V384z" />
    <path d="M384 832h256a32 32 0 1 1 0 64H384a32 32 0 1 1 0-64z" />
  </svg>
);

/** 录制图标:实心圆点。 */
const RecordIcon = (
  <svg viewBox="0 0 1024 1024" fill="currentColor">
    <circle cx="512" cy="512" r="300" />
  </svg>
);

/** 解析输入框为正整数;非法返回 0(联动换算时再回退基准)。 */
const parseDim = (s: string): number => {
  const n = Math.floor(Number(s));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** 解析比例输入(百分比)为 zoom 值;空/非正 → 0(占位,允许输入框清空与中间态如 "5"),
 * 上限 300。focusFrame 用 getNormalizedZoom 兜底极小值。 */
const parseZoom = (s: string): number => {
  const pct = Number(s);
  if (!Number.isFinite(pct) || pct <= 0) {
    return 0;
  }
  return Math.min(300, pct) / 100;
};

/** 秒数 → "m:ss"(录制计时显示)。 */
const formatElapsed = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export const SlidesPanel = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const { t } = useI18n();
  const [slides, setSlides] = useState<ExcalidrawFrameElement[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // 调试用:跟踪 appState(zoom/scroll),用于在 frame 起点画锚点标记。
  const [appState, setAppState] = useState<AppState | null>(null);

  const [config, setConfig] = useState<SlideConfig>(getEffectiveConfig);
  const { presetId, width, height } = config;

  const [customPresets] = useState<AspectPreset[]>(loadCustomPresets);

  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  /** 是否显示 frame 中心锚点标记(默认关闭)。 */
  const [showAnchor, setShowAnchor] = useState(false);
  /** 浏览器是否支持 Document Picture-in-Picture(置顶小窗,仅 Chrome/Edge)。 */
  const [supportsPip] = useState(() => supportsDocumentPiP());
  /** 浏览器是否支持录制(MediaRecorder + getUserMedia + canvas.captureStream)。 */
  const [supportsRec] = useState(() => supportsRecording());
  /** 是否正在录制。 */
  const [isRecording, setIsRecording] = useState(false);
  /** 录制已用秒数(计时显示)。 */
  const [recElapsed, setRecElapsed] = useState(0);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const recTimerRef = useRef<number | null>(null);
  /** 录制配置(两层持久化,镜像 slide-config)。 */
  const [recConfig, setRecConfig] = useState<RecordingConfig>(
    getEffectiveRecordingConfig,
  );
  /** 设置 popover 分栏:幻灯片 / 录制。 */
  const [settingsTab, setSettingsTab] = useState<"slides" | "recording">(
    "slides",
  );
  /** 摄像头 <video> ref(overlay 与 recorder drawImage 共用同一元素)。 */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** 当前摄像头流(cameraEnabled 时 acquire,关闭/切设备时 release)。 */
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  /** 当前麦克风流(micEnabled 时 acquire → 触发授权 + 刷新设备列表;录制复用)。 */
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  micStreamRef.current = micStream;
  /** 录制配置实时 ref(避免 recorder 闭包捕获 stale state,支持录制中拖拽/切换)。 */
  const recConfigRef = useRef(recConfig);
  recConfigRef.current = recConfig;
  /** 摄像头气泡是否正被拖拽(录制指针抑制用,Slice 5)。 */
  const [cameraDragging, setCameraDragging] = useState(false);
  const cameraDraggingRef = useRef(false);
  cameraDraggingRef.current = cameraDragging;
  /** 最新鼠标屏幕坐标(pointermove 更新;录制指针用)。 */
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);
  /** appState 实时 ref(recorder 读 zoom/scroll/offset 算指针位置)。 */
  const appStateRef = useRef(appState);
  appStateRef.current = appState;
  /** 可用摄像头/麦克风列表(授权后带 label)。 */
  const [videoInputs, setVideoInputs] = useState<MediaDevice[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDevice[]>([]);
  /** 刷新设备列表(授权后 label 才有)。 */
  const refreshDevices = useCallback(async () => {
    setVideoInputs(await listVideoInputs());
    setAudioInputs(await listAudioInputs());
  }, []);
  /**
   * 取流后轮询刷新,直到对应类型出现 label(或无设备 / 达上限)。
   * 单次固定延迟在慢机 / 长 label 延迟下会遗漏 → 用累计重试(0/300/700/1200/1800ms)兜底。
   */
  const refreshDevicesUntilLabeled = useCallback(
    async (kind: "video" | "audio") => {
      const schedule = [0, 300, 700, 1200, 1800];
      let elapsed = 0;
      for (const target of schedule) {
        const delay = target - elapsed;
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
        elapsed = target;
        await refreshDevices();
        // 用原始 label 判断是否停止:listVideoInputs 的 fallback「摄像头 N」是非空字符串,
        // 不能用 list.some(label) —— 那样第一次就误判"已有 label"立即退出。
        if (await hasDeviceLabels(kind)) {
          return;
        }
      }
    },
    [refreshDevices],
  );
  /** 画中画小窗实例(非 null 时把 <Teleprompter /> portal 进去)。 */
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  /** 画布内提词浮层开关(displayMode==="inline" 时 portal 到主文档 body)。 */
  const [inlinePrompterOpen, setInlinePrompterOpen] = useState(false);
  /** 提词器设置快照(全局共享,存 teleprompter-storage);单次读取初始化三份派生 state。 */
  const [initialTpSettings] = useState(loadSettings);
  /** 提词器形态("pip"=画中画 / "inline"=画布内浮层)。 */
  const [teleprompterDisplayMode, setTeleprompterDisplayMode] = useState<
    "pip" | "inline"
  >(() => initialTpSettings.displayMode);
  /** 提词器配色主题(黑/白),录制分栏控制。 */
  const [teleprompterTheme, setTeleprompterTheme] = useState<"dark" | "light">(
    () => initialTpSettings.theme,
  );
  /** 提词器背景透明度(0–100,越大越透,100=全透;画布内模式生效)。 */
  const [teleprompterBgTransparency, setTeleprompterBgTransparency] = useState(
    () => initialTpSettings.bgTransparency,
  );

  /** 改提词器形态:merge 最新 settings 存储(不丢 speed/字号等)。 */
  const changeTeleprompterDisplayMode = (mode: "pip" | "inline") => {
    setTeleprompterDisplayMode(mode);
    updateSettings({ displayMode: mode });
  };
  /** 改背景透明度(0–100,越大越透):props 换算 alpha 实时传 <Teleprompter/>。 */
  const changeTeleprompterBgTransparency = (v: number) => {
    setTeleprompterBgTransparency(v);
    updateSettings({ bgTransparency: v });
  };
  /** 改配色主题(黑/白):props 实时同步(pip 与画布内都生效)。 */
  const changeTeleprompterTheme = (t: "dark" | "light") => {
    setTeleprompterTheme(t);
    updateSettings({ theme: t });
  };

  /** 点"提词器":按当前形态开/关(pip=画中画,inline=画布内浮层)。 */
  const handleTogglePrompter = async () => {
    if (teleprompterDisplayMode === "inline") {
      setInlinePrompterOpen((v) => !v);
      return;
    }
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }
    const w = await requestTeleprompterPiP();
    if (!w) {
      return;
    }
    w.addEventListener("pagehide", () => setPipWindow(null));
    setPipWindow(w);
  };

  /** 形态切换:若提词器正开,自动切到新形态(关旧开新);关着则不动。 */
  useEffect(() => {
    const wasOpen = pipWindow || inlinePrompterOpen;
    // 关旧形态
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
    }
    setInlinePrompterOpen(false);
    if (!wasOpen) {
      return;
    }
    if (teleprompterDisplayMode === "inline") {
      setInlinePrompterOpen(true);
      return;
    }
    // 开 PiP:requestWindow 需 user activation——切形态的点击距 effect 执行仅几 ms,
    // 仍在激活窗口内;万一过期/失败则静默保持关闭,用户手点一次即可。
    // cancelled:快速来回切换形态时,先发出的 requestWindow 稍后才 resolve——
    // 不防护会在 inline 形态下打开孤儿 PiP 窗(按钮走 inline 分支,再也关不掉它)
    let cancelled = false;
    requestTeleprompterPiP().then((w) => {
      if (!w) {
        return;
      }
      if (cancelled) {
        w.close();
        return;
      }
      w.addEventListener("pagehide", () => setPipWindow(null));
      setPipWindow(w);
    });
    return () => {
      cancelled = true;
    };
    // 仅在形态变化时跑;pipWindow/inlinePrompterOpen 取闭包当前值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teleprompterDisplayMode]);

  /** 点录制按钮:开始 / 停止。无聚焦 slide 时忽略(避免录到空)。 */
  const handleToggleRecord = async () => {
    if (isRecording) {
      const handle = recorderRef.current;
      if (handle) {
        try {
          const blob = await handle.stop();
          downloadBlob(blob, recordingFilename(mimeToExt(blob.type)));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[recorder] stop failed", e);
        }
        recorderRef.current = null;
      }
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = null;
      }
      setRecElapsed(0);
      setIsRecording(false);
      return;
    }
    if (!excalidrawAPI || !focusedFrameRef.current) {
      return;
    }
    try {
      recorderRef.current = startRecorder({
        excalidrawAPI,
        getFrame: getLiveFocusedFrame,
        getCamera: () => ({
          enabled: recConfigRef.current.cameraEnabled,
          getVideoEl: () => videoRef.current,
          shape: recConfigRef.current.cameraShape,
          sizePct: recConfigRef.current.cameraSizePct,
          x: recConfigRef.current.cameraX,
          y: recConfigRef.current.cameraY,
        }),
        audioStream: micStreamRef.current,
        getPointer: () => {
          if (
            !recConfigRef.current.pointerEnabled ||
            cameraDraggingRef.current
          ) {
            return null;
          }
          const pos = pointerPosRef.current;
          const fr = getLiveFocusedFrame();
          const as = appStateRef.current;
          if (!pos || !fr || !as) {
            return null;
          }
          return {
            enabled: true,
            pos: screenToSlide(
              pos,
              {
                zoom: as.zoom.value,
                scrollX: as.scrollX,
                scrollY: as.scrollY,
                offsetLeft: as.offsetLeft,
                offsetTop: as.offsetTop,
              },
              { x: fr.x, y: fr.y, width: fr.width, height: fr.height },
            ),
          };
        },
        onStateChange: (state) => {
          if (state === "error") {
            // 录制中途致命错误:停 UI + 清理 + 提示(R2:不再静默出废片)
            recorderRef.current = null;
            if (recTimerRef.current) {
              clearInterval(recTimerRef.current);
              recTimerRef.current = null;
            }
            setRecElapsed(0);
            setIsRecording(false);
            // eslint-disable-next-line no-alert
            alert("录制中途出错,已停止,请重试。");
          }
        },
      });
      setIsRecording(true);
      setRecElapsed(0);
      recTimerRef.current = window.setInterval(() => {
        setRecElapsed((s) => s + 1);
      }, 1000);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[recorder] start failed", e);
    }
  };

  // R1:录制中离开页面(切画布 / 关页 / 刷新)会静默丢录制 → beforeunload 警告
  useEffect(() => {
    if (!isRecording) {
      return;
    }
    const handler = (e: BeforeUnloadEvent) => preventUnload(e);
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isRecording]);

  const dragId = useRef<string | null>(null);
  /** 当前聚焦的 frame,供 config.zoom 变化时立即重新聚焦。 */
  const focusedFrameRef = useRef<ExcalidrawFrameElement | null>(null);
  /**
   * 以 ref 记录的 id 从场景实时解析聚焦 frame。
   * ref 里的元素对象在拖动/删除后会过期(坐标是旧值),
   * 录制裁剪、指针换算、zoom 重聚焦都必须取场景里的最新对象。
   */
  const getLiveFocusedFrame = useCallback((): ExcalidrawFrameElement | null => {
    const id = focusedFrameRef.current?.id;
    if (!excalidrawAPI || !id) {
      return null;
    }
    return (
      (excalidrawAPI.getSceneElements().find((el) => el.id === id) as
        | ExcalidrawFrameElement
        | undefined) ?? null
    );
  }, [excalidrawAPI]);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  const currentPreset = findPreset(presetId, customPresets);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    const refresh = () => {
      setSlides(getSlides(excalidrawAPI.getSceneElements()));
      setAppState(excalidrawAPI.getAppState());
    };
    refresh();
    return excalidrawAPI.onChange(refresh);
  }, [excalidrawAPI]);

  useEffect(() => {
    if (width > 0 && height > 0) {
      saveCanvasConfig(config);
    }
  }, [config, width, height]);

  // 录制配置变化 → 防抖持久化(拖摄像头 pointermove 频繁触发 setRecConfig →
  // 不防抖 localStorage.setItem 几十次/秒 → 主线程卡顿)。500ms 内仅最后一次写。
  useEffect(() => {
    const handle = window.setTimeout(
      () => saveCanvasRecordingConfig(recConfig),
      500,
    );
    return () => window.clearTimeout(handle);
  }, [recConfig]);

  // 摄像头流 acquire/release:cameraEnabled → 取流(deviceId 精确或默认);关/切设备 → 停轨释放
  useEffect(() => {
    if (!recConfig.cameraEnabled) {
      return;
    }
    let active = true;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({
        video: recConfig.cameraDeviceId
          ? { deviceId: { exact: recConfig.cameraDeviceId } }
          : true,
        audio: false,
      })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setCameraStream(s);
        // 授权后轮询刷新设备列表直到 label 出现(兜 Chrome label 延迟,单次延迟会遗漏)
        void refreshDevicesUntilLabeled("video");
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[camera] acquire failed", e);
      });
    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      setCameraStream(null);
    };
  }, [
    recConfig.cameraEnabled,
    recConfig.cameraDeviceId,
    refreshDevicesUntilLabeled,
  ]);

  // 麦克风流 acquire/release:micEnabled → 取流(触发授权 + 设备列表拿 label);关/切设备 → 释放。
  // 录制复用此流(不再在 record start 取 → 授权时机正确,设备列表 enable 后即可见)。
  useEffect(() => {
    if (!recConfig.micEnabled) {
      return;
    }
    let active = true;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({
        audio: recConfig.micDeviceId
          ? { deviceId: { exact: recConfig.micDeviceId } }
          : true,
        video: false,
      })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setMicStream(s);
        void refreshDevicesUntilLabeled("audio");
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[mic] acquire failed", e);
      });
    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      setMicStream(null);
    };
  }, [recConfig.micEnabled, recConfig.micDeviceId, refreshDevicesUntilLabeled]);

  // 设备枚举:mount + devicechange 刷新;取流后的刷新由 camera/mic effect 显式调 refreshDevices
  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        refreshDevices,
      );
    };
  }, [refreshDevices]);

  // 跟踪鼠标屏幕坐标(录制指针源);仅存 ref,不动 React 状态
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerPosRef.current = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  // 设置 popover:点外部关闭
  useEffect(() => {
    if (!showSettings) {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        settingsRef.current?.contains(target) ||
        settingsBtnRef.current?.contains(target)
      ) {
        return;
      }
      setShowSettings(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showSettings]);

  // 起点/间距/宽高变化 → 重排所有现有 slide(同步尺寸 + 位置)。
  // 仅当"布局相关配置值"真正变化时才重排:
  // - 启动时 excalidrawAPI 实例会更换(多次注入),仅 api 变化不触发重排,
  //   导入文件/手动拖动后的布局不会被加载过程覆盖
  // - 250ms 防抖:配置输入框连续键入时不逐键重排、不逐键写撤销历史
  const lastLayoutDepsRef = useRef<string | null>(null);
  useEffect(() => {
    if (!excalidrawAPI || config.width < 1 || config.height < 1) {
      return;
    }
    const layoutKey = JSON.stringify([
      config.startX ?? null,
      config.startY ?? null,
      config.gap,
      config.direction,
      config.width,
      config.height,
    ]);
    const prevKey = lastLayoutDepsRef.current;
    lastLayoutDepsRef.current = layoutKey;
    if (prevKey === null || prevKey === layoutKey) {
      // 首次记录,或只是 excalidrawAPI 实例更换:不重排
      return;
    }
    const layout: SlideLayout = {
      start: { x: config.startX ?? 0, y: config.startY ?? 0 },
      direction: config.direction,
      width: config.width,
      height: config.height,
      gap: config.gap,
    };
    const timer = setTimeout(() => {
      const elements = excalidrawAPI.getSceneElements();
      const slidesNow = getSlides(elements);
      if (slidesNow.length === 0) {
        return;
      }
      let slideIndex = 0;
      const next = elements.map((el) => {
        if (!slidesNow.some((s) => s.id === el.id)) {
          return el;
        }
        const frame = el as ExcalidrawFrameElement;
        const c = slideCenterAt(slideIndex, layout);
        slideIndex += 1;
        return newElementWith(frame, {
          width: config.width,
          height: config.height,
          x: c.x - config.width / 2,
          y: c.y - config.height / 2,
        });
      });
      excalidrawAPI.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [
    config.startX,
    config.startY,
    config.gap,
    config.direction,
    config.width,
    config.height,
    excalidrawAPI,
  ]);

  const focusFrame = (frame: ExcalidrawFrameElement) => {
    if (!excalidrawAPI) {
      return;
    }
    const appState = excalidrawAPI.getAppState();
    // 锚点 = frame 中心:水平钉屏幕中线(居中缩放,中心不动)、垂直留顶部工具栏空白。
    const focus = computeFocus(
      { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      { width: appState.width, height: appState.height },
      {
        topPadding: DEFAULT_TOP_PADDING,
        zoom: getNormalizedZoom(config.zoom ?? 1),
        offsetLeft: appState.offsetLeft,
        offsetTop: appState.offsetTop,
      },
    );
    focusedFrameRef.current = frame;
    excalidrawAPI.updateScene({
      appState: {
        zoom: { value: getNormalizedZoom(focus.zoom) },
        scrollX: focus.scrollX,
        scrollY: focus.scrollY,
      },
    });
    setFocusedId(frame.id);
  };

  // 调试可视化:当前聚焦 frame 中心的屏幕坐标(缩放锚点,水平应稳在屏幕中线)。
  const focusedFrame = slides.find((s) => s.id === focusedId) ?? null;
  let anchor: { x: number; y: number } | null = null;
  let frameScreen: FrameScreen | null = null;
  if (focusedFrame && appState) {
    const z = appState.zoom.value;
    anchor = {
      x:
        (focusedFrame.x + focusedFrame.width / 2 + appState.scrollX) * z +
        appState.offsetLeft,
      y:
        (focusedFrame.y + focusedFrame.height / 2 + appState.scrollY) * z +
        appState.offsetTop,
    };
    frameScreen = {
      x: (focusedFrame.x + appState.scrollX) * z + appState.offsetLeft,
      y: (focusedFrame.y + appState.scrollY) * z + appState.offsetTop,
      w: focusedFrame.width * z,
      h: focusedFrame.height * z,
    };
  }

  // 显示比例变化 → 立即重新聚焦当前 frame(用新比例),无需再次点击。
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    const frame = getLiveFocusedFrame();
    if (!frame) {
      return;
    }
    const appState = excalidrawAPI.getAppState();
    const focus = computeFocus(
      { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      { width: appState.width, height: appState.height },
      {
        topPadding: DEFAULT_TOP_PADDING,
        zoom: getNormalizedZoom(config.zoom ?? 1),
        offsetLeft: appState.offsetLeft,
        offsetTop: appState.offsetTop,
      },
    );
    excalidrawAPI.updateScene({
      appState: {
        zoom: { value: getNormalizedZoom(focus.zoom) },
        scrollX: focus.scrollX,
        scrollY: focus.scrollY,
      },
    });
  }, [config.zoom, excalidrawAPI, getLiveFocusedFrame]);

  const handleSelectPreset = (id: string) => {
    // 「自定义」预设:保持当前宽高,允许独立调整(不锁定比例)
    if (id === "custom") {
      setConfig((c) => ({ ...c, presetId: "custom" }));
      return;
    }
    const p = findPreset(id, customPresets);
    setConfig((c) => ({
      ...c,
      presetId: id,
      width: p.width,
      height: p.height,
    }));
  };

  const handleWidth = (raw: string) => {
    const w = parseDim(raw);
    setConfig((c) => {
      const preset = findPreset(c.presetId, customPresets);
      // 锁定预设:改宽 → 高按比例联动;「自定义」:只改宽
      return preset.locked
        ? { ...c, width: w, height: heightFromWidth(w, preset) }
        : { ...c, width: w };
    });
  };
  const handleHeight = (raw: string) => {
    const h = parseDim(raw);
    setConfig((c) => {
      const preset = findPreset(c.presetId, customPresets);
      return preset.locked
        ? { ...c, height: h, width: widthFromHeight(h, preset) }
        : { ...c, height: h };
    });
  };

  const handleSaveDefault = () => saveDefaultConfig(config);

  // 第一张 frame 起点(canvas 坐标,可负);frame 间距
  const handleStartX = (raw: string) => {
    const n = Number(raw);
    setConfig((c) => ({ ...c, startX: Number.isFinite(n) ? n : 0 }));
  };
  const handleStartY = (raw: string) => {
    const n = Number(raw);
    setConfig((c) => ({ ...c, startY: Number.isFinite(n) ? n : 0 }));
  };
  const handleGap = (raw: string) =>
    setConfig((c) => ({ ...c, gap: Math.max(0, parseDim(raw)) }));
  const handleZoom = (raw: string) =>
    setConfig((c) => ({ ...c, zoom: parseZoom(raw) }));

  // 恢复出厂:重置当前画布 + 全局默认为出厂配置
  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    saveDefaultConfig(DEFAULT_CONFIG);
    saveCanvasConfig(DEFAULT_CONFIG);
  };

  const configPreset: AspectPreset = {
    id: presetId,
    label: currentPreset.label,
    width,
    height,
    locked: currentPreset.locked,
  };

  const handleCreate = () => {
    if (!excalidrawAPI || width < 1 || height < 1) {
      return;
    }
    // 起点:有已存在 slide → 最后一张沿方向轴后侧;否则用配置的起点 X/Y
    const last = slides[slides.length - 1];
    const direction = config.direction;
    const center: Point = last
      ? direction === "vertical"
        ? {
            x: last.x + last.width / 2,
            y: last.y + last.height + config.gap + configPreset.height / 2,
          }
        : {
            x: last.x + last.width + config.gap + configPreset.width / 2,
            y: last.y + last.height / 2,
          }
      : { x: config.startX ?? 0, y: config.startY ?? 0 };
    const frames = createSlides({
      preset: configPreset,
      center,
      count: 1,
      startIndex: slides.length,
      gap: config.gap,
    });
    if (frames.length === 0) {
      return;
    }
    excalidrawAPI.updateScene({
      elements: syncInvalidIndices([
        ...excalidrawAPI.getSceneElements(),
        ...frames,
      ]),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    focusFrame(frames[0]);
  };

  /**
   * 按 getSlides 的数组顺序把 slide 依次铺位(锚定 base 起点),非 slide 元素不动。
   * 默认名(Slide N)同步重编号,用户自定义名只挪位置不改名。
   */
  const relayoutSlides = (
    elements: readonly ExcalidrawElement[],
    base: Point,
  ): ExcalidrawElement[] => {
    const slidesInOrder = getSlides(elements);
    const positions: Point[] = [];
    let cursorX = base.x;
    let cursorY = base.y;
    for (const f of slidesInOrder) {
      positions.push({ x: cursorX, y: cursorY });
      if (config.direction === "vertical") {
        cursorY += f.height + config.gap;
      } else {
        cursorX += f.width + config.gap;
      }
    }
    return elements.map((el) => {
      const idx = slidesInOrder.findIndex((s) => s.id === el.id);
      if (idx < 0) {
        return el;
      }
      const frame = el as ExcalidrawFrameElement;
      const isDefaultName = /^Slide \d+$/.test(frame.name ?? "");
      return isDefaultName
        ? newElementWith(frame, {
            name: `Slide ${idx + 1}`,
            x: positions[idx].x,
            y: positions[idx].y,
          })
        : newElementWith(frame, {
            x: positions[idx].x,
            y: positions[idx].y,
          });
    });
  };

  const handleReorder = (fromId: string, toId: string) => {
    if (!excalidrawAPI || fromId === toId) {
      return;
    }
    const elements = excalidrawAPI.getSceneElements();
    const beforeIds = getSlides(elements)
      .map((s) => s.id)
      .join();
    const next = reorderFrames(elements, fromId, toId);
    if (
      getSlides(next)
        .map((s) => s.id)
        .join() === beforeIds
    ) {
      return;
    }
    // 拖序只改数组顺序(z-order);同步把物理位置按新顺序铺位(锚定原首张位置),
    // 避免后续删除/重排时列表顺序与画布布局脱节、整体跳变
    const base = getSlides(elements)[0];
    excalidrawAPI.updateScene({
      elements: relayoutSlides(next, { x: base?.x ?? 0, y: base?.y ?? 0 }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const handleDelete = (frameId: string) => {
    if (!excalidrawAPI) {
      return;
    }
    const deleted = softDeleteFrame(excalidrawAPI.getSceneElements(), frameId);
    // 剩余 slide:重新编号 + 物理位置前移(锚定剩余首张原位,后续者填补空位)
    const remaining = getSlides(deleted);
    const base = remaining[0];
    const next = relayoutSlides(deleted, {
      x: base?.x ?? 0,
      y: base?.y ?? 0,
    });
    excalidrawAPI.updateScene({
      elements: next,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    // 删除的是当前聚焦的 slide → 切换到下一个;没有下一个则上一个;全删完则清空
    if (frameId === focusedId) {
      if (remaining.length === 0) {
        focusedFrameRef.current = null;
        setFocusedId(null);
        return;
      }
      const deletedIdx = slides.findIndex((s) => s.id === frameId);
      const targetIdx = Math.min(deletedIdx, remaining.length - 1);
      // 用重排后的真实元素聚焦(而非拼一个伪元素)
      const target = getSlides(next)[targetIdx] as ExcalidrawFrameElement;
      focusFrame(target);
    }
  };

  // 折叠态:缩小到约一半(Island 紧凑 + small 按钮)
  if (collapsed) {
    return (
      <div className="slides-dock slides-dock--collapsed">
        <Island padding={0}>
          <IconButton
            type="icon"
            size="small"
            aria-label={t("labels.slidesExpand")}
            title={t("labels.slidesExpand")}
            icon={sidebarRightIcon}
            onClick={() => setCollapsed(false)}
          />
        </Island>
        {pipWindow &&
          createPortal(
            <Teleprompter
              theme={teleprompterTheme}
              onThemeChange={changeTeleprompterTheme}
            />,
            pipWindow.document.body,
          )}
        {inlinePrompterOpen &&
          createPortal(
            <Teleprompter
              variant="inline"
              bgOpacity={1 - teleprompterBgTransparency / 100}
              theme={teleprompterTheme}
              onThemeChange={changeTeleprompterTheme}
            />,
            document.body,
          )}
      </div>
    );
  }

  return (
    <div className="slides-dock">
      <Island padding={2}>
        <div className="slides-dock__header">{t("labels.slidesTitle")}</div>
        <div className="slides-dock__top">
          <IconButton
            type="icon"
            aria-label={t("labels.slidesCollapse")}
            title={t("labels.slidesCollapse")}
            icon={chevronRight}
            disabled={isRecording}
            onClick={() => setCollapsed(true)}
          />
          <IconButton
            type="icon"
            aria-label={
              showAnchor
                ? t("labels.slidesHideAnchor")
                : t("labels.slidesShowAnchor")
            }
            title={
              showAnchor
                ? t("labels.slidesHideAnchor")
                : t("labels.slidesShowAnchor")
            }
            icon={TargetIcon}
            className={showAnchor ? "slides-dock__btn--active" : undefined}
            onClick={() => setShowAnchor((v) => !v)}
          />
          <IconButton
            ref={settingsBtnRef}
            type="icon"
            aria-label={t("labels.slidesSettings")}
            title={t("labels.slidesSettings")}
            icon={settingsIcon}
            className={showSettings ? "slides-dock__btn--active" : undefined}
            onClick={() => setShowSettings((v) => !v)}
          />
          <IconButton
            type="icon"
            aria-label={t("labels.teleprompterOpen")}
            title={t("labels.teleprompterOpen")}
            icon={PrompterIcon}
            className={
              pipWindow || inlinePrompterOpen
                ? "slides-dock__btn--active"
                : undefined
            }
            disabled={teleprompterDisplayMode === "pip" && !supportsPip}
            onClick={handleTogglePrompter}
          />
          {isRecording ? (
            <button
              type="button"
              className="slides-dock__rec"
              aria-label={t("labels.slidesStopRecord")}
              title={t("labels.slidesStopRecord")}
              onClick={handleToggleRecord}
            >
              <span className="slides-dock__rec-dot" />
              REC {formatElapsed(recElapsed)}
            </button>
          ) : (
            <IconButton
              type="icon"
              aria-label={t("labels.slidesStartRecord")}
              title={t("labels.slidesStartRecord")}
              icon={RecordIcon}
              className="slides-dock__rec-btn"
              disabled={!supportsRec}
              onClick={handleToggleRecord}
            />
          )}
          <IconButton
            type="icon"
            aria-label={t("labels.slidesAdd")}
            title={t("labels.slidesAdd")}
            icon={PlusIcon}
            onClick={handleCreate}
            disabled={!excalidrawAPI || width < 1 || height < 1}
          />
        </div>

        {showSettings && (
          <div className="slides-dock__settings" ref={settingsRef}>
            <div className="slides-dock__segmented slides-dock__settings-tabs">
              {(["slides", "recording"] as const).map((tab) => (
                <button
                  key={tab}
                  aria-pressed={settingsTab === tab}
                  className={settingsTab === tab ? "is-active" : ""}
                  onClick={() => setSettingsTab(tab)}
                >
                  {tab === "slides"
                    ? t("labels.slidesTitle")
                    : t("labels.slidesRecording")}
                </button>
              ))}
            </div>
            {settingsTab === "slides" && (
              <>
                <label className="slides-dock__field">
                  <span>{t("labels.slidesAspect")}</span>
                  <select
                    value={presetId}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                  >
                    {getAllPresets(customPresets).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.labelKey ? t(p.labelKey) : p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="slides-dock__field">
                  <span>
                    {currentPreset.locked
                      ? t("labels.slidesWidth")
                      : t("labels.slidesWidthFree")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={width || ""}
                    onChange={(e) => handleWidth(e.target.value)}
                  />
                </label>
                <label className="slides-dock__field">
                  <span>{t("labels.slidesHeight")}</span>
                  <input
                    type="number"
                    min={1}
                    value={height || ""}
                    onChange={(e) => handleHeight(e.target.value)}
                  />
                </label>
                <label className="slides-dock__field">
                  <span>{t("labels.slidesStartX")}</span>
                  <input
                    type="number"
                    value={config.startX ?? 0}
                    onChange={(e) => handleStartX(e.target.value)}
                  />
                </label>
                <label className="slides-dock__field">
                  <span>{t("labels.slidesStartY")}</span>
                  <input
                    type="number"
                    value={config.startY ?? 0}
                    onChange={(e) => handleStartY(e.target.value)}
                  />
                </label>
                <label className="slides-dock__field">
                  <span>{t("labels.slidesGap")}</span>
                  <input
                    type="number"
                    min={0}
                    value={config.gap}
                    onChange={(e) => handleGap(e.target.value)}
                  />
                </label>
                <label className="slides-dock__field">
                  <span>{t("labels.slidesDirection")}</span>
                  <div className="slides-dock__segmented">
                    {(["horizontal", "vertical"] as const).map((d) => (
                      <button
                        key={d}
                        aria-pressed={config.direction === d}
                        className={config.direction === d ? "is-active" : ""}
                        onClick={() =>
                          setConfig((c) => ({ ...c, direction: d }))
                        }
                      >
                        {d === "horizontal"
                          ? t("labels.slidesDirectionHorizontal")
                          : t("labels.slidesDirectionVertical")}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="slides-dock__field">
                  <span>{t("labels.slidesZoom")}</span>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={Math.round((config.zoom ?? 1) * 100) || ""}
                    onChange={(e) => handleZoom(e.target.value)}
                    onBlur={() => {
                      // 清空后失焦 → 恢复 100%,避免持久化 0。
                      if (!config.zoom) {
                        setConfig((c) => ({ ...c, zoom: 1 }));
                      }
                    }}
                  />
                </label>
                <Button onSelect={handleSaveDefault}>
                  {t("labels.slidesSaveDefault")}
                </Button>
                <Button onSelect={handleReset}>
                  {t("labels.slidesReset")}
                </Button>
              </>
            )}
            {settingsTab === "recording" && (
              <>
                {/* —— 摄像头 —— */}
                <div className="slides-dock__rec-title">
                  <span>{t("labels.slidesRecCamera")}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={recConfig.cameraEnabled}
                    className={`slides-dock__switch${
                      recConfig.cameraEnabled ? " is-on" : ""
                    }`}
                    onClick={() =>
                      setRecConfig((c) => ({
                        ...c,
                        cameraEnabled: !c.cameraEnabled,
                      }))
                    }
                  />
                </div>
                <label className="slides-dock__field">
                  <select
                    value={recConfig.cameraDeviceId ?? ""}
                    disabled={!recConfig.cameraEnabled}
                    onChange={(e) =>
                      setRecConfig((c) => ({
                        ...c,
                        cameraDeviceId: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">
                      {t("labels.slidesRecDefaultDevice")}
                    </option>
                    {videoInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="slides-dock__field">
                  <span>{t("labels.slidesRecShape")}</span>
                  <div className="slides-dock__segmented">
                    {(["circle", "square"] as const).map((s) => (
                      <button
                        key={s}
                        disabled={!recConfig.cameraEnabled}
                        aria-pressed={recConfig.cameraShape === s}
                        className={
                          recConfig.cameraShape === s ? "is-active" : ""
                        }
                        onClick={() =>
                          setRecConfig((c) => ({ ...c, cameraShape: s }))
                        }
                      >
                        {s === "circle"
                          ? t("labels.slidesRecCircle")
                          : t("labels.slidesRecSquare")}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="slides-dock__field">
                  <span>
                    {t("labels.slidesRecSize")} {recConfig.cameraSizePct}%
                  </span>
                  <input
                    type="range"
                    min={8}
                    max={30}
                    value={recConfig.cameraSizePct}
                    className="slides-dock__slider"
                    disabled={!recConfig.cameraEnabled}
                    onChange={(e) =>
                      setRecConfig((c) => ({
                        ...c,
                        cameraSizePct: Math.min(
                          30,
                          Math.max(8, Number(e.target.value)),
                        ),
                      }))
                    }
                  />
                </label>
                {/* —— 麦克风 —— */}
                <div className="slides-dock__rec-title">
                  <span>{t("labels.slidesRecMic")}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={recConfig.micEnabled}
                    disabled={isRecording}
                    className={`slides-dock__switch${
                      recConfig.micEnabled ? " is-on" : ""
                    }`}
                    onClick={() =>
                      setRecConfig((c) => ({ ...c, micEnabled: !c.micEnabled }))
                    }
                  />
                </div>
                <label className="slides-dock__field">
                  <select
                    value={recConfig.micDeviceId ?? ""}
                    disabled={!recConfig.micEnabled || isRecording}
                    onChange={(e) =>
                      setRecConfig((c) => ({
                        ...c,
                        micDeviceId: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">
                      {t("labels.slidesRecDefaultDevice")}
                    </option>
                    {audioInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* —— 指针 —— */}
                <div className="slides-dock__rec-title">
                  <span>{t("labels.slidesRecPointer")}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={recConfig.pointerEnabled}
                    className={`slides-dock__switch${
                      recConfig.pointerEnabled ? " is-on" : ""
                    }`}
                    onClick={() =>
                      setRecConfig((c) => ({
                        ...c,
                        pointerEnabled: !c.pointerEnabled,
                      }))
                    }
                  />
                </div>

                {/* —— 提词器 —— */}
                <div className="slides-dock__rec-title">
                  <span>{t("labels.slidesRecTeleprompter")}</span>
                </div>
                <label className="slides-dock__field">
                  <span>{t("labels.slidesRecForm")}</span>
                  <div className="slides-dock__segmented">
                    {(["pip", "inline"] as const).map((m) => (
                      <button
                        key={m}
                        disabled={m === "pip" && !supportsPip}
                        aria-pressed={teleprompterDisplayMode === m}
                        className={
                          teleprompterDisplayMode === m ? "is-active" : ""
                        }
                        onClick={() => changeTeleprompterDisplayMode(m)}
                      >
                        {m === "pip"
                          ? t("labels.slidesRecFormPip")
                          : t("labels.slidesRecFormCanvas")}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="slides-dock__field">
                  <span>
                    {t("labels.slidesRecBgOpacity")}{" "}
                    {teleprompterBgTransparency}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={teleprompterBgTransparency}
                    className="slides-dock__slider"
                    disabled={teleprompterDisplayMode !== "inline"}
                    onChange={(e) =>
                      changeTeleprompterBgTransparency(
                        Math.min(100, Math.max(0, Number(e.target.value))),
                      )
                    }
                  />
                </label>
              </>
            )}
          </div>
        )}

        <ol className="slides-dock__list">
          {slides.map((slide, i) => (
            <li
              key={slide.id}
              className={`slides-dock__item${
                slide.id === focusedId ? " slides-dock__item--active" : ""
              }`}
              draggable
              onDragStart={() => {
                dragId.current = slide.id;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId.current) {
                  handleReorder(dragId.current, slide.id);
                }
                dragId.current = null;
              }}
            >
              <IconButton
                className="slides-dock__slide-btn"
                type="icon"
                aria-label={slide.name ?? `Slide ${i + 1}`}
                title={slide.name ?? `Slide ${i + 1}`}
                icon={<span className="slides-dock__num">{i + 1}</span>}
                onClick={() => focusFrame(slide)}
              >
                <span
                  className="slides-dock__delete"
                  role="button"
                  tabIndex={0}
                  aria-label={t("labels.slidesDelete")}
                  title={t("labels.slidesDelete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(slide.id);
                  }}
                >
                  {CloseIcon}
                </span>
              </IconButton>
            </li>
          ))}
        </ol>
      </Island>
      {showAnchor &&
        anchor &&
        createPortal(
          <div
            className="slides-anchor-marker"
            style={{ left: anchor.x, top: anchor.y }}
            title={t("labels.slidesAnchorMarker")}
          />,
          document.body,
        )}
      <CameraBubble
        stream={cameraStream}
        videoRef={videoRef}
        shape={recConfig.cameraShape}
        sizePct={recConfig.cameraSizePct}
        frameScreen={frameScreen}
        pos={{ x: recConfig.cameraX, y: recConfig.cameraY }}
        onPosChange={(p) =>
          setRecConfig((c) => ({ ...c, cameraX: p.x, cameraY: p.y }))
        }
        onDragStateChange={setCameraDragging}
      />
      {pipWindow &&
        createPortal(
          <Teleprompter
            theme={teleprompterTheme}
            onThemeChange={changeTeleprompterTheme}
          />,
          pipWindow.document.body,
        )}
      {inlinePrompterOpen &&
        createPortal(
          <Teleprompter
            variant="inline"
            bgOpacity={1 - teleprompterBgTransparency / 100}
            theme={teleprompterTheme}
            onThemeChange={changeTeleprompterTheme}
          />,
          document.body,
        )}
    </div>
  );
};
