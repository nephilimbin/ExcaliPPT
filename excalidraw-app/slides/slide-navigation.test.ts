import { describe, it, expect } from "vitest";

import { computeFocus } from "./slide-navigation";

const TOP_PADDING = 80; // 工具栏高度 + 边距

// 把 {zoom, scrollX, scrollY} 还原成 frame 在屏幕上的盒子,用于几何断言。
const frameOnScreen = (
  frame: { x: number; y: number; width: number; height: number },
  r: { zoom: number; scrollX: number; scrollY: number },
  offsetLeft = 0,
  offsetTop = 0,
) => ({
  left: (frame.x + r.scrollX) * r.zoom + offsetLeft,
  top: (frame.y + r.scrollY) * r.zoom + offsetTop,
  width: frame.width * r.zoom,
  height: frame.height * r.zoom,
});

describe("computeFocus", () => {
  const viewport = { width: 1500, height: 940 };

  it("frame 顶部对齐工具栏下方(非居中)", () => {
    const frame = { x: 0, y: 0, width: 1920, height: 1080 };
    const r = computeFocus(frame, viewport, { topPadding: TOP_PADDING });
    expect(frameOnScreen(frame, r).top).toBe(TOP_PADDING);
  });

  it("frame 水平居中于视口", () => {
    const frame = { x: 1234, y: 567, width: 1920, height: 1080 };
    const r = computeFocus(frame, viewport, { topPadding: TOP_PADDING });
    const box = frameOnScreen(frame, r);
    // 左右留白相等
    expect(box.left).toBeCloseTo((viewport.width - box.width) / 2, 6);
  });

  it("横屏 frame 完整放进视口(不溢出):1920×1080 @ 1500×940", () => {
    const frame = { x: 0, y: 0, width: 1920, height: 1080 };
    const r = computeFocus(frame, viewport, { topPadding: TOP_PADDING });
    const box = frameOnScreen(frame, r);
    expect(box.left).toBeGreaterThanOrEqual(-1e-6);
    expect(box.left + box.width).toBeLessThanOrEqual(viewport.width + 1e-6);
    expect(box.top).toBeCloseTo(TOP_PADDING, 6);
    expect(box.top + box.height).toBeLessThanOrEqual(viewport.height + 1e-6);
  });

  it("竖屏 frame 完整放进视口(不溢出):1080×1920 @ 1500×940", () => {
    const frame = { x: 0, y: 0, width: 1080, height: 1920 };
    const r = computeFocus(frame, viewport, { topPadding: TOP_PADDING });
    const box = frameOnScreen(frame, r);
    expect(box.left).toBeGreaterThanOrEqual(-1e-6);
    expect(box.left + box.width).toBeLessThanOrEqual(viewport.width + 1e-6);
    expect(box.top).toBeCloseTo(TOP_PADDING, 6);
    // 垂直方向严格不溢出(竖屏高度是约束轴)
    expect(box.top + box.height).toBeLessThanOrEqual(viewport.height + 1e-6);
  });

  it("极端大 frame(10000×10000)仍不溢出、顶部对齐", () => {
    const frame = { x: 5000, y: 5000, width: 10000, height: 10000 };
    const r = computeFocus(frame, viewport, { topPadding: TOP_PADDING });
    const box = frameOnScreen(frame, r);
    expect(box.top + box.height).toBeLessThanOrEqual(viewport.height + 1e-6);
    expect(box.left + box.width).toBeLessThanOrEqual(viewport.width + 1e-6);
    expect(box.top).toBeCloseTo(TOP_PADDING, 6);
  });

  it("极端小 frame(100×100)不溢出、顶部对齐", () => {
    const frame = { x: 0, y: 0, width: 100, height: 100 };
    const r = computeFocus(frame, viewport, { topPadding: TOP_PADDING });
    const box = frameOnScreen(frame, r);
    expect(box.top + box.height).toBeLessThanOrEqual(viewport.height + 1e-6);
    expect(box.left + box.width).toBeLessThanOrEqual(viewport.width + 1e-6);
    expect(box.top).toBeCloseTo(TOP_PADDING, 6);
  });

  it("大屏视口(3000×2000)能容纳 1920×1080 且顶部对齐", () => {
    const bigViewport = { width: 3000, height: 2000 };
    const frame = { x: 100, y: 100, width: 1920, height: 1080 };
    const r = computeFocus(frame, bigViewport, { topPadding: TOP_PADDING });
    const box = frameOnScreen(frame, r);
    expect(box.top).toBeCloseTo(TOP_PADDING, 6);
    expect(box.top + box.height).toBeLessThanOrEqual(bigViewport.height + 1e-6);
    expect(box.left + box.width).toBeLessThanOrEqual(bigViewport.width + 1e-6);
  });

  it("固定 zoom(options.zoom):frame 中心钉水平中线、顶边钉 topPadding,与 zoom 无关", () => {
    const frame = { x: 100, y: 200, width: 1920, height: 1080 };
    for (const zoom of [0.5, 1, 2]) {
      const r = computeFocus(frame, viewport, {
        topPadding: TOP_PADDING,
        zoom,
      });
      const box = frameOnScreen(frame, r);
      expect(r.zoom).toBe(zoom);
      expect(box.top).toBeCloseTo(TOP_PADDING, 6);
      expect(box.left + box.width / 2).toBeCloseTo(viewport.width / 2, 6);
    }
  });
});
