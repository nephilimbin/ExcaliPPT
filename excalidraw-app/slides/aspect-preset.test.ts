import { describe, it, expect } from "vitest";

import {
  BUILTIN_PRESETS,
  DEFAULT_PRESET_ID,
  findPreset,
  getAllPresets,
  getPreset,
  heightFromWidth,
  widthFromHeight,
  type AspectPreset,
} from "./aspect-preset";

describe("aspect-preset", () => {
  it("出厂含 16:9 / 9:16 / 4:3 / 3:4 / 1:1", () => {
    const ids = BUILTIN_PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["16:9", "9:16", "4:3", "3:4", "1:1"]),
    );
  });

  it("4:3 与 3:4 互为转置(短边同为 1080)", () => {
    const p = getPreset("4:3");
    expect(p.width).toBe(1440);
    expect(p.height).toBe(1080);
    expect(p.locked).toBe(true);
    const r = getPreset("3:4");
    expect(p.width).toBe(r.height);
    expect(p.height).toBe(r.width);
  });

  it("默认预设是 16:9 / 1920×1080", () => {
    expect(DEFAULT_PRESET_ID).toBe("16:9");
    const p = getPreset("16:9");
    expect(p.width).toBe(1920);
    expect(p.height).toBe(1080);
  });

  it("找不到的预设回退默认 16:9", () => {
    expect(getPreset("does-not-exist").id).toBe("16:9");
  });

  it("9:16 是竖屏(高>宽)", () => {
    const p = getPreset("9:16");
    expect(p.height).toBeGreaterThan(p.width);
  });

  it("出厂比例预设 locked:true;「自定义」locked:false(自由比例)", () => {
    expect(getPreset("16:9").locked).toBe(true);
    expect(getPreset("9:16").locked).toBe(true);
    expect(getPreset("custom").locked).toBe(false);
  });

  it("出厂含「自定义」预设选项", () => {
    expect(BUILTIN_PRESETS.map((p) => p.id)).toContain("custom");
  });
});

describe("锁定联动换算", () => {
  it("改长算高:16:9 长宽成比例(1920→1080、960→540)", () => {
    expect(heightFromWidth(1920, getPreset("16:9"))).toBe(1080);
    expect(heightFromWidth(960, getPreset("16:9"))).toBe(540);
  });

  it("改高算长:16:9(1080→1920)", () => {
    expect(widthFromHeight(1080, getPreset("16:9"))).toBe(1920);
  });

  it("竖屏 9:16 换算:高 1920 → 长 1080;长 1080 → 高 1920", () => {
    expect(widthFromHeight(1920, getPreset("9:16"))).toBe(1080);
    expect(heightFromWidth(1080, getPreset("9:16"))).toBe(1920);
  });

  it("换算后比例始终等于预设(锁定不可破坏)", () => {
    for (const p of BUILTIN_PRESETS) {
      const w = 1234;
      const h = heightFromWidth(w, p);
      // 换算后 w/h ≈ 预设 w/h(舍入误差内)
      expect(h / w).toBeCloseTo(p.height / p.width, 3);
    }
  });

  it("双向换算幂等(改长→高→长 ≈ 原长)", () => {
    for (const p of BUILTIN_PRESETS) {
      const w = 1500;
      const back = widthFromHeight(heightFromWidth(w, p), p);
      expect(back).toBeGreaterThan(w - 2);
      expect(back).toBeLessThan(w + 2);
    }
  });

  it("非法输入(≤0 / NaN)回退基准分辨率", () => {
    const p = getPreset("16:9");
    expect(heightFromWidth(0, p)).toBe(p.height);
    expect(heightFromWidth(-5, p)).toBe(p.height);
    expect(heightFromWidth(NaN, p)).toBe(p.height);
    expect(widthFromHeight(0, p)).toBe(p.width);
    expect(widthFromHeight(-5, p)).toBe(p.width);
    expect(widthFromHeight(NaN, p)).toBe(p.width);
  });
});

describe("自定义预设(Issue 06)", () => {
  const custom: AspectPreset = {
    id: "my-vertical",
    label: "我的竖屏",
    width: 900,
    height: 1600,
    locked: true,
  };

  it("getAllPresets:无自定义 = 仅出厂", () => {
    expect(getAllPresets([])).toEqual([...BUILTIN_PRESETS]);
  });

  it("getAllPresets:出厂在前、自定义在后", () => {
    const all = getAllPresets([custom]);
    expect(all).toHaveLength(BUILTIN_PRESETS.length + 1);
    expect(all[0]).toEqual(BUILTIN_PRESETS[0]);
    expect(all[all.length - 1]).toEqual(custom);
  });

  it("findPreset 查自定义预设", () => {
    expect(findPreset("my-vertical", [custom])).toEqual(custom);
  });

  it("findPreset 仍能查出厂预设", () => {
    expect(findPreset("9:16", [custom]).id).toBe("9:16");
  });

  it("findPreset 找不到 → 回退默认出厂 16:9", () => {
    expect(findPreset("does-not-exist", [custom]).id).toBe("16:9");
    expect(findPreset("does-not-exist", []).id).toBe("16:9");
  });

  it("自定义预设的锁定联动生效(比例取自该预设)", () => {
    // 900×1600 比例:改宽 1800 → 高 = 1800/(900/1600)=3200
    expect(heightFromWidth(1800, custom)).toBe(3200);
    expect(widthFromHeight(1600, custom)).toBe(900);
  });
});
