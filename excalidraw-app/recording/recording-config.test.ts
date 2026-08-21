import { describe, it, expect, beforeEach } from "vitest";

import {
  DEFAULT_RECORDING_CONFIG,
  getEffectiveRecordingConfig,
  loadCanvasRecordingConfig,
  loadDefaultRecordingConfig,
  saveCanvasRecordingConfig,
  saveDefaultRecordingConfig,
  type RecordingConfig,
} from "./recording-config";

const camOn: RecordingConfig = {
  ...DEFAULT_RECORDING_CONFIG,
  cameraEnabled: true,
  cameraShape: "square",
  cameraSizePct: 20,
};
const pointerOff: RecordingConfig = {
  ...DEFAULT_RECORDING_CONFIG,
  pointerEnabled: false,
  cameraSizePct: 10,
};

/** 切换当前画布(default → 无 query;其他 → ?canvas=<id>)。 */
const setCanvas = (id: string) => {
  window.history.pushState({}, "", id === "default" ? "/" : `/?canvas=${id}`);
};

describe("recording-config 两层持久化", () => {
  beforeEach(() => {
    localStorage.clear();
    setCanvas("default");
  });

  it("saveDefaultRecordingConfig / loadDefaultRecordingConfig 往返(全局键)", () => {
    expect(loadDefaultRecordingConfig()).toBeNull();
    saveDefaultRecordingConfig(camOn);
    expect(loadDefaultRecordingConfig()).toEqual(camOn);
  });

  it("saveCanvasRecordingConfig / loadCanvasRecordingConfig 往返(画布键)", () => {
    expect(loadCanvasRecordingConfig()).toBeNull();
    saveCanvasRecordingConfig(camOn);
    expect(loadCanvasRecordingConfig()).toEqual(camOn);
  });

  it("无任何配置 → getEffectiveRecordingConfig 回退出厂默认", () => {
    expect(getEffectiveRecordingConfig()).toEqual(DEFAULT_RECORDING_CONFIG);
    expect(getEffectiveRecordingConfig().cameraEnabled).toBe(false);
    expect(getEffectiveRecordingConfig().pointerEnabled).toBe(true);
  });

  it("只有默认配置 → effective = 默认", () => {
    saveDefaultRecordingConfig(camOn);
    expect(getEffectiveRecordingConfig()).toEqual(camOn);
  });

  it("只有画布配置 → effective = 画布", () => {
    saveCanvasRecordingConfig(pointerOff);
    expect(getEffectiveRecordingConfig()).toEqual(pointerOff);
  });

  it("画布配置覆盖默认配置(Canvas 优先)", () => {
    saveDefaultRecordingConfig(camOn);
    saveCanvasRecordingConfig(pointerOff);
    expect(getEffectiveRecordingConfig()).toEqual(pointerOff);
  });

  it("仅默认存在时,新画布继承默认", () => {
    saveDefaultRecordingConfig(camOn);
    setCanvas("newboard");
    expect(loadCanvasRecordingConfig()).toBeNull();
    expect(getEffectiveRecordingConfig()).toEqual(camOn);
  });

  it("不同 ?canvas= 画布配置互相隔离", () => {
    setCanvas("a");
    saveCanvasRecordingConfig(camOn);
    expect(loadCanvasRecordingConfig()).toEqual(camOn);

    setCanvas("b");
    expect(loadCanvasRecordingConfig()).toBeNull();
    saveCanvasRecordingConfig(pointerOff);
    expect(loadCanvasRecordingConfig()).toEqual(pointerOff);

    setCanvas("a");
    expect(loadCanvasRecordingConfig()).toEqual(camOn);
  });

  it("非法 JSON / 结构错误 → 回退 null(不抛错)", () => {
    localStorage.setItem("excalidraw-recording-default-config", "{not json");
    expect(loadDefaultRecordingConfig()).toBeNull();
    localStorage.setItem(
      "excalidraw-recording-default-config",
      JSON.stringify({ foo: "bar" }),
    );
    expect(loadDefaultRecordingConfig()).toBeNull();
  });

  it("旧持久化数据缺字段 → getEffectiveRecordingConfig 用出厂补齐", () => {
    // 模拟只有部分字段的旧数据(cameraEnabled 缺失 → 不通过 isRecordingConfig → 回退默认)
    localStorage.setItem(
      "excalidraw-recording-default-config",
      JSON.stringify({ cameraEnabled: true }),
    );
    const eff = getEffectiveRecordingConfig();
    // 仅 cameraEnabled 不构成合法 RecordingConfig → 整体回退出厂
    expect(eff).toEqual(DEFAULT_RECORDING_CONFIG);
  });
});
