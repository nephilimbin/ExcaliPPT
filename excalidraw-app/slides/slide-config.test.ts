import { describe, it, expect, beforeEach } from "vitest";

import {
  DEFAULT_CONFIG,
  getEffectiveConfig,
  loadCanvasConfig,
  loadCustomPresets,
  loadDefaultConfig,
  saveCanvasConfig,
  saveDefaultConfig,
  upsertCustomPreset,
  type SlideConfig,
} from "./slide-config";

import type { AspectPreset } from "./aspect-preset";

const portrait: SlideConfig = {
  presetId: "9:16",
  width: 1080,
  height: 1920,
  gap: 100,
  direction: "horizontal",
};
const square: SlideConfig = {
  presetId: "1:1",
  width: 1080,
  height: 1080,
  gap: 100,
  direction: "horizontal",
};

/** 切换当前画布(default → 无 query;其他 → ?canvas=<id>)。 */
const setCanvas = (id: string) => {
  window.history.pushState({}, "", id === "default" ? "/" : `/?canvas=${id}`);
};

describe("slide-config 两层持久化", () => {
  beforeEach(() => {
    localStorage.clear();
    setCanvas("default");
  });

  it("saveDefaultConfig / loadDefaultConfig 往返(全局键)", () => {
    expect(loadDefaultConfig()).toBeNull();
    saveDefaultConfig(portrait);
    expect(loadDefaultConfig()).toEqual(portrait);
  });

  it("saveCanvasConfig / loadCanvasConfig 往返(画布键)", () => {
    expect(loadCanvasConfig()).toBeNull();
    saveCanvasConfig(portrait);
    expect(loadCanvasConfig()).toEqual(portrait);
  });

  it("无任何配置 → getEffectiveConfig 回退出厂默认 16:9/1920×1080", () => {
    expect(getEffectiveConfig()).toEqual(DEFAULT_CONFIG);
    expect(getEffectiveConfig().presetId).toBe("16:9");
  });

  it("只有默认配置 → effective = 默认", () => {
    saveDefaultConfig(portrait);
    expect(getEffectiveConfig()).toEqual(portrait);
  });

  it("只有画布配置 → effective = 画布", () => {
    saveCanvasConfig(square);
    expect(getEffectiveConfig()).toEqual(square);
  });

  it("画布配置覆盖默认配置(Canvas 优先)", () => {
    saveDefaultConfig(portrait);
    saveCanvasConfig(square);
    expect(getEffectiveConfig()).toEqual(square);
  });

  it("仅默认存在时,新画布继承默认", () => {
    saveDefaultConfig(portrait);
    setCanvas("newboard");
    // 新画布无画布配置 → 继承全局默认
    expect(loadCanvasConfig()).toBeNull();
    expect(getEffectiveConfig()).toEqual(portrait);
  });

  it("不同 ?canvas= 画布配置互相隔离", () => {
    setCanvas("a");
    saveCanvasConfig(portrait);
    expect(loadCanvasConfig()).toEqual(portrait);

    setCanvas("b");
    // 画布 b 读不到画布 a 的配置
    expect(loadCanvasConfig()).toBeNull();
    saveCanvasConfig(square);
    expect(loadCanvasConfig()).toEqual(square);

    // 画布 a 的配置仍在,未受 b 影响
    setCanvas("a");
    expect(loadCanvasConfig()).toEqual(portrait);
  });

  it("默认配置是全局的,跨画布可见", () => {
    saveDefaultConfig(portrait);
    setCanvas("a");
    expect(loadDefaultConfig()).toEqual(portrait);
    setCanvas("b");
    expect(loadDefaultConfig()).toEqual(portrait);
  });

  it("zoom(默认显示比例)随配置持久化往返", () => {
    const withZoom: SlideConfig = { ...portrait, zoom: 1.5 };
    saveDefaultConfig(withZoom);
    expect(loadDefaultConfig()).toEqual(withZoom);
    expect(loadDefaultConfig()?.zoom).toBe(1.5);
  });

  it("非法 JSON / 结构错误 → 回退 null(不抛错)", () => {
    localStorage.setItem("excalidraw-slides-default-config", "{not json");
    expect(loadDefaultConfig()).toBeNull();
    localStorage.setItem(
      "excalidraw-slides-default-config",
      JSON.stringify({ foo: "bar" }),
    );
    expect(loadDefaultConfig()).toBeNull();
  });

  it("旧持久化数据无 direction → getEffectiveConfig 归一化为 horizontal", () => {
    // 模拟改动前持久化的数据(无 direction 字段)
    localStorage.setItem(
      "excalidraw-slides-default-config",
      JSON.stringify({
        presetId: "9:16",
        width: 1080,
        height: 1920,
        gap: 100,
      }),
    );
    const eff = getEffectiveConfig();
    expect(eff.direction).toBe("horizontal");
    expect(eff.presetId).toBe("9:16");
  });
});

describe("自定义预设持久化(Issue 06)", () => {
  const a: AspectPreset = {
    id: "preset-a",
    label: "A",
    width: 800,
    height: 600,
    locked: true,
  };
  const b: AspectPreset = {
    id: "preset-b",
    label: "B",
    width: 1000,
    height: 1000,
    locked: true,
  };

  beforeEach(() => {
    localStorage.clear();
    setCanvas("default");
  });

  it("初始无自定义预设 → 空列表", () => {
    expect(loadCustomPresets()).toEqual([]);
  });

  it("upsertCustomPreset 追加预设", () => {
    expect(upsertCustomPreset(a)).toEqual([a]);
    expect(loadCustomPresets()).toEqual([a]);
  });

  it("upsertCustomPreset 同 id 覆盖(去重,长度不变)", () => {
    upsertCustomPreset(a);
    const updated: AspectPreset = { ...a, width: 999, height: 999 };
    expect(upsertCustomPreset(updated)).toEqual([updated]);
    expect(loadCustomPresets()).toEqual([updated]);
  });

  it("多个不同 id 自定义预设共存", () => {
    upsertCustomPreset(a);
    upsertCustomPreset(b);
    expect(loadCustomPresets()).toEqual([a, b]);
  });

  it("自定义预设全局可见(跨画布)", () => {
    setCanvas("a");
    upsertCustomPreset(a);
    setCanvas("b");
    // 另一画布也能读到全局自定义预设
    expect(loadCustomPresets()).toEqual([a]);
  });

  it("非法 JSON → 回退空列表(不抛错)", () => {
    localStorage.setItem("excalidraw-slides-custom-presets", "{broken");
    expect(loadCustomPresets()).toEqual([]);
  });
});
