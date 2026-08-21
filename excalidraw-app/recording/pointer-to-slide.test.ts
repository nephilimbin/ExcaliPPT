import { describe, it, expect } from "vitest";

import { screenToSlide } from "./pointer-to-slide";

// 正向变换:screenX = (canvasX + scrollX) * zoom + offsetLeft
// 取 frame 在 (1000, 500)、1920×1080、zoom=2、scroll=(−400,−200)、offset=(10,20)
// 则 frame 屏幕左上 = (1000 + (-400)) * 2 + 10 = 1210 ;(500-200)*2+20=620
const vp = {
  zoom: 2,
  scrollX: -400,
  scrollY: -200,
  offsetLeft: 10,
  offsetTop: 20,
};
const frame = { x: 1000, y: 500, width: 1920, height: 1080 };

describe("pointer-to-slide screenToSlide", () => {
  it("屏幕坐标 → slide 局部坐标(与正向变换自洽)", () => {
    // frame 左上屏幕 (1210,620) → slide 局部 (0,0)
    const p = screenToSlide({ x: 1210, y: 620 }, vp, frame);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(0, 5);
    expect(p.inBounds).toBe(true);
  });

  it("zoom=1 无偏移:屏幕 = canvas 坐标,减 frame 即局部", () => {
    const p = screenToSlide(
      { x: 250, y: 150 },
      { zoom: 1, scrollX: 0, scrollY: 0, offsetLeft: 0, offsetTop: 0 },
      { x: 100, y: 50, width: 1000, height: 1000 },
    );
    expect(p.x).toBe(150);
    expect(p.y).toBe(100);
    expect(p.inBounds).toBe(true);
  });

  it("zoom 缩放:屏幕 2x → 局部按 1/zoom 还原", () => {
    // 屏幕移动 200px(zoom=2)→ 局部移动 100px
    const p = screenToSlide({ x: 1210 + 200, y: 620 }, vp, frame);
    expect(p.x).toBeCloseTo(100, 5);
    expect(p.inBounds).toBe(true);
  });

  it("边界外(左上)→ inBounds false", () => {
    const p = screenToSlide({ x: 1209, y: 620 }, vp, frame); // x 刚好 < 0
    expect(p.x).toBeLessThan(0);
    expect(p.inBounds).toBe(false);
  });

  it("边界外(右下越界)→ inBounds false", () => {
    // frame 右下屏幕 = (1210 + 1920*2, 620 + 1080*2);超过即越界
    const p = screenToSlide({ x: 1210 + 1920 * 2 + 1, y: 620 }, vp, frame);
    expect(p.x).toBeGreaterThan(frame.width);
    expect(p.inBounds).toBe(false);
  });

  it("zoom<=0 兜底为 1(不除零)", () => {
    const p = screenToSlide(
      { x: 50, y: 50 },
      { zoom: 0, scrollX: 0, scrollY: 0, offsetLeft: 0, offsetTop: 0 },
      { x: 0, y: 0, width: 100, height: 100 },
    );
    expect(p.x).toBe(50);
    expect(p.inBounds).toBe(true);
  });
});
