// Slice 3: 摄像头气泡(编辑器 overlay)。live <video> + 圆/方遮罩 + 可拖拽。
// 位置用归一化坐标持久化(经 SlidesPanel 写回 RecordingConfig);<video> ref 由
// 父级持有并喂给 recorder 的 drawCameraBubble(同一流,双渲染路径)。
// portal 到 body + position:fixed → 不受画布 scroll/zoom 影响(参照锚点标记)。

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { RefObject } from "react";

export interface FrameScreen {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CameraBubbleProps {
  stream: MediaStream | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  shape: "circle" | "square";
  /** 占 slide 宽度百分比(8–30)。 */
  sizePct: number;
  /** 聚焦 frame 的屏幕矩形(null 时不渲染)。 */
  frameScreen: FrameScreen | null;
  /** 气泡中心,归一化 0..1。 */
  pos: { x: number; y: number };
  onPosChange: (pos: { x: number; y: number }) => void;
  /** 拖拽状态回调(供录制指针抑制,Slice 5)。 */
  onDragStateChange: (dragging: boolean) => void;
}

export const CameraBubble = ({
  stream,
  videoRef,
  shape,
  sizePct,
  frameScreen,
  pos,
  onPosChange,
  onDragStateChange,
}: CameraBubbleProps) => {
  // srcObject 绑定:用 state 化 video 元素 —— video 挂载 或 stream 变化 都触发绑定。
  // 修「先开摄像头后建 slide」:video 后挂载时 ref.current 变化不触发旧 effect 的问题。
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      setVideoEl(el);
    },
    [videoRef],
  );
  useEffect(() => {
    if (!videoEl) {
      return;
    }
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }
    if (stream) {
      videoEl.play().catch(() => {
        // 自动播放被拦/设备忙 → 忽略;录制侧 drawImage 仍可读已解码帧
      });
    }
  }, [videoEl, stream]);

  /** 拖拽抓取点相对气泡中心的屏幕偏移(保持 → 抓哪儿跟哪儿,不跳到中心)。 */
  const grabOffsetRef = useRef<{ x: number; y: number } | null>(null);

  if (!stream || !frameScreen) {
    return null;
  }

  const edge = (sizePct / 100) * frameScreen.w;
  const cx = frameScreen.x + pos.x * frameScreen.w;
  const cy = frameScreen.y + pos.y * frameScreen.h;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // stopPropagation:防指针事件冒泡到 Excalidraw 画布(触发选区/绘制)
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // 记录抓取点相对气泡中心的偏移,移动时保持 → 不跳到中心
    grabOffsetRef.current = { x: e.clientX - cx, y: e.clientY - cy };
    onDragStateChange(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !grabOffsetRef.current) {
      return;
    }
    const off = grabOffsetRef.current;
    // 新中心 = 鼠标 - 抓取偏移 → 抓取点始终在鼠标下
    const nx = Math.min(
      1,
      Math.max(0, (e.clientX - off.x - frameScreen.x) / frameScreen.w),
    );
    const ny = Math.min(
      1,
      Math.max(0, (e.clientY - off.y - frameScreen.y) / frameScreen.h),
    );
    onPosChange({ x: nx, y: ny });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    grabOffsetRef.current = null;
    onDragStateChange(false);
  };

  return createPortal(
    <div
      draggable={false}
      style={{
        position: "fixed",
        left: cx - edge / 2,
        top: cy - edge / 2,
        width: edge,
        height: edge,
        borderRadius: shape === "circle" ? "50%" : "12%",
        overflow: "hidden",
        border: "2px solid rgba(255, 255, 255, 0.9)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
        cursor: "grab",
        zIndex: 9999,
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <video
        ref={setVideoRef}
        draggable={false}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
          pointerEvents: "none",
        }}
      />
    </div>,
    document.body,
  );
};
