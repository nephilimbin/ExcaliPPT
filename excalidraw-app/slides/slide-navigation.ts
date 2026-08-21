// 幻灯片导航:计算聚焦到某 frame 的视口状态(zoom + scroll)。
// 纯函数,可独立单测。意图——点击幻灯片后画布缩放聚焦:
// (1) frame 完整放进视口(不溢出);(2) frame 顶部对齐工具栏下方(非居中)。
// 详见 CONTEXT.md / ADR-0001。

export interface FocusTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FocusViewport {
  /** 视口宽(screen px) */
  width: number;
  /** 视口高(screen px) */
  height: number;
}

export interface FocusResult {
  /** 目标 zoom 值(appState.zoom.value) */
  zoom: number;
  /** 目标 scrollX(appState) */
  scrollX: number;
  /** 目标 scrollY(appState) */
  scrollY: number;
}

export interface FocusOptions {
  /**
   * frame 顶部在屏幕上预留的留白(工具栏高度 + 边距,screen px)。
   * frame 顶边对齐此位置。
   */
  topPadding: number;
  /** 固定 zoom(省略 → 自适应 fit:frame 完整放进视口不溢出)。 */
  zoom?: number;
  /** canvas 相对视口的 DOM 偏移(默认 0)。 */
  offsetLeft?: number;
  offsetTop?: number;
}

/** 默认顶部留白:顶部工具栏 + 选中工具后的属性栏高度 + 边距。 */
export const DEFAULT_TOP_PADDING = 120;

/**
 * 计算聚焦到 frame 的视口(zoom + scrollX/Y)。
 *
 * 锚点:frame 中心钉屏幕水平中线(左右对称缩放)、顶边对齐 topPadding(避让工具栏)。
 *
 * 坐标关系(Excalidraw):screen = (canvas + scroll) * zoom + offset
 *   (scroll 是 canvas 空间平移,反解时需除 zoom)。
 *   - 水平居中:viewport.width/2 = (frame.x + frame.width/2 + scrollX) * zoom + offsetLeft
 *   - 顶部对齐:topPadding = (frame.y + scrollY) * zoom + offsetTop
 *
 * zoom:传 options.zoom → 用该固定值(用户设定的显示比例);省略 → 自适应 fit。
 */
export const computeFocus = (
  frame: FocusTarget,
  viewport: FocusViewport,
  options: FocusOptions,
): FocusResult => {
  const { topPadding, offsetLeft = 0, offsetTop = 0 } = options;
  const zoom =
    options.zoom ??
    Math.min(
      viewport.width / frame.width,
      (viewport.height - topPadding) / frame.height,
    );
  const scrollX =
    (viewport.width / 2 - offsetLeft) / zoom - (frame.x + frame.width / 2);
  const scrollY = (topPadding - offsetTop) / zoom - frame.y;
  return { zoom, scrollX, scrollY };
};
