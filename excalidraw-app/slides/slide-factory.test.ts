import { describe, it, expect } from "vitest";

import { getPreset } from "./aspect-preset";
import {
  createSlide,
  createSlides,
  slideCenterAt,
  DEFAULT_GAP,
  type SlideLayout,
} from "./slide-factory";

describe("createSlide", () => {
  it("产出 frame 元素,尺寸 = 预设分辨率", () => {
    const frame = createSlide({
      preset: getPreset("16:9"),
      center: { x: 0, y: 0 },
    });
    expect(frame.type).toBe("frame");
    expect(frame.width).toBe(1920);
    expect(frame.height).toBe(1080);
  });

  it("frame 中心对齐 center(左上角 = center − size/2)", () => {
    const frame = createSlide({
      preset: getPreset("16:9"),
      center: { x: 1000, y: 500 },
    });
    expect(frame.x).toBe(1000 - 960);
    expect(frame.y).toBe(500 - 540);
  });

  it("命名 Slide {index+1}", () => {
    const preset = getPreset("1:1");
    expect(createSlide({ preset, center: { x: 0, y: 0 }, index: 0 }).name).toBe(
      "Slide 1",
    );
    expect(createSlide({ preset, center: { x: 0, y: 0 }, index: 2 }).name).toBe(
      "Slide 3",
    );
  });

  it("省略 index 默认 Slide 1", () => {
    const frame = createSlide({
      preset: getPreset("1:1"),
      center: { x: 0, y: 0 },
    });
    expect(frame.name).toBe("Slide 1");
  });
});

describe("createSlides", () => {
  it("count ≤ 0 返回空数组", () => {
    expect(
      createSlides({
        preset: getPreset("16:9"),
        center: { x: 0, y: 0 },
        count: 0,
      }),
    ).toEqual([]);
    expect(
      createSlides({
        preset: getPreset("16:9"),
        center: { x: 0, y: 0 },
        count: -3,
      }),
    ).toEqual([]);
  });

  it("count=1:第一张中心 = firstCenter", () => {
    const center = { x: 1000, y: 500 };
    const [only] = createSlides({
      preset: getPreset("1:1"),
      center,
      count: 1,
    });
    // 中心 = 左上角 + 尺寸/2
    expect(only.x + only.width / 2).toBe(center.x);
    expect(only.y + only.height / 2).toBe(center.y);
  });

  it("横屏(16:9)横向并排:中心 y 对齐、x 递增,不粘连(gap)", () => {
    const center = { x: 0, y: 2000 };
    const p = getPreset("16:9");
    const frames = createSlides({ preset: p, center, count: 3 });
    expect(frames).toHaveLength(3);
    // 中心 y 全部对齐
    for (const f of frames) {
      expect(f.y + f.height / 2).toBe(center.y);
    }
    // 相邻 frame 右/左边间距 = gap
    for (let i = 0; i < frames.length - 1; i++) {
      expect(frames[i + 1].x - (frames[i].x + frames[i].width)).toBe(
        DEFAULT_GAP,
      );
    }
    expect(frames[1].x).toBeGreaterThan(frames[0].x);
  });

  it("竖屏(9:16)横向并排:中心 y 对齐、x 递增,不粘连(gap)", () => {
    const center = { x: 0, y: 2000 };
    const p = getPreset("9:16");
    const frames = createSlides({ preset: p, center, count: 3 });
    expect(frames).toHaveLength(3);
    // 中心 y 全部对齐
    for (const f of frames) {
      expect(f.y + f.height / 2).toBe(center.y);
    }
    // 相邻 frame 右/左边间距 = gap
    for (let i = 0; i < frames.length - 1; i++) {
      expect(frames[i + 1].x - (frames[i].x + frames[i].width)).toBe(
        DEFAULT_GAP,
      );
    }
    expect(frames[1].x).toBeGreaterThan(frames[0].x);
  });

  it("命名接续 startIndex:Slide {startIndex+1}..", () => {
    const frames = createSlides({
      preset: getPreset("16:9"),
      center: { x: 0, y: 0 },
      count: 3,
      startIndex: 2,
    });
    expect(frames.map((f) => f.name)).toEqual([
      "Slide 3",
      "Slide 4",
      "Slide 5",
    ]);
  });

  it("自定义 gap 生效(相邻间距随 gap 变化)", () => {
    const p = getPreset("16:9");
    const a = createSlides({
      preset: p,
      center: { x: 0, y: 0 },
      count: 2,
      gap: 50,
    });
    const b = createSlides({
      preset: p,
      center: { x: 0, y: 0 },
      count: 2,
      gap: 250,
    });
    const diffA = a[1].x - (a[0].x + a[0].width);
    const diffB = b[1].x - (b[0].x + b[0].width);
    expect(diffA).toBe(50);
    expect(diffB).toBe(250);
  });

  it("direction=vertical:中心 x 对齐、y 按 height+gap 递增,不粘连(gap)", () => {
    const center = { x: 3000, y: 0 };
    const p = getPreset("16:9");
    const frames = createSlides({
      preset: p,
      center,
      count: 3,
      direction: "vertical",
    });
    expect(frames).toHaveLength(3);
    // 中心 x 全部对齐
    for (const f of frames) {
      expect(f.x + f.width / 2).toBe(center.x);
    }
    // 相邻 frame 下/上边间距 = gap
    for (let i = 0; i < frames.length - 1; i++) {
      expect(frames[i + 1].y - (frames[i].y + frames[i].height)).toBe(
        DEFAULT_GAP,
      );
    }
    expect(frames[1].y).toBeGreaterThan(frames[0].y);
  });
});

describe("slideCenterAt", () => {
  const layout: SlideLayout = {
    start: { x: 100, y: 200 },
    direction: "horizontal",
    width: 1920,
    height: 1080,
    gap: 100,
  };

  it("horizontal:x 按 width+gap 递增,y 对齐 start.y", () => {
    expect(slideCenterAt(0, layout)).toEqual({ x: 100, y: 200 });
    expect(slideCenterAt(1, layout)).toEqual({ x: 2120, y: 200 });
    expect(slideCenterAt(2, layout)).toEqual({ x: 4140, y: 200 });
  });

  it("vertical:y 按 height+gap 递增,x 对齐 start.x", () => {
    const vLayout: SlideLayout = { ...layout, direction: "vertical" };
    expect(slideCenterAt(0, vLayout)).toEqual({ x: 100, y: 200 });
    expect(slideCenterAt(1, vLayout)).toEqual({ x: 100, y: 1380 });
    expect(slideCenterAt(2, vLayout)).toEqual({ x: 100, y: 2560 });
  });
});
