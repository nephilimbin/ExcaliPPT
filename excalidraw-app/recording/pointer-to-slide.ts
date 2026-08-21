// Slice 5: 编辑器屏幕坐标 → 当前 slide 局部坐标的视口逆变换 + 边界判定。纯函数,单测。
// 反推正向变换 screenX = (canvasX + scrollX) * zoom + offsetLeft(见 SlidesPanel 锚点)。

export interface ScreenPos {
  x: number;
  y: number;
}

export interface Viewport {
  zoom: number;
  scrollX: number;
  scrollY: number;
  offsetLeft: number;
  offsetTop: number;
}

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PointerSlidePos {
  /** slide 局部像素(相对 frame 左上;frame 内容 = 目标分辨率 → 1 单位 = 1 录制像素)。 */
  x: number;
  y: number;
  /** 是否落在当前 slide 边界内(仅界内才画指针)。 */
  inBounds: boolean;
}

/** 屏幕坐标 → slide 局部坐标 + 边界判定。zoom<=0 视为 1 兜底。 */
export const screenToSlide = (
  screen: ScreenPos,
  vp: Viewport,
  frame: FrameRect,
): PointerSlidePos => {
  const zoom = vp.zoom > 0 ? vp.zoom : 1;
  const canvasX = (screen.x - vp.offsetLeft) / zoom - vp.scrollX;
  const canvasY = (screen.y - vp.offsetTop) / zoom - vp.scrollY;
  const lx = canvasX - frame.x;
  const ly = canvasY - frame.y;
  return {
    x: lx,
    y: ly,
    inBounds: lx >= 0 && lx < frame.width && ly >= 0 && ly < frame.height,
  };
};
