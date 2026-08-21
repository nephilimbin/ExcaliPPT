import { describe, it, expect, afterEach } from "vitest";

import {
  hasDeviceLabels,
  listAudioInputs,
  listVideoInputs,
  reconcileDeviceId,
} from "./device-list";

const mkDevice = (
  kind: MediaDeviceInfo["kind"],
  deviceId: string,
  label = "",
): MediaDeviceInfo =>
  ({
    kind,
    deviceId,
    label,
    groupId: "g",
    toJSON: () => "",
  } as MediaDeviceInfo);

/** 注入 navigator.mediaDevices.enumerateDevices mock。 */
const stubEnumerate = (devices: MediaDeviceInfo[]) => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { enumerateDevices: async () => devices },
  });
};

const clearMediaDevices = () => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
};

describe("device-list", () => {
  afterEach(() => clearMediaDevices());

  it("listVideoInputs 只取 videoinput + 空 label 回退「摄像头 N」", async () => {
    stubEnumerate([
      mkDevice("videoinput", "v1", ""),
      mkDevice("audioinput", "a1", "Mic"),
      mkDevice("videoinput", "v2", "FaceTime"),
    ]);
    expect(await listVideoInputs()).toEqual([
      { deviceId: "v1", label: "摄像头 1" },
      { deviceId: "v2", label: "FaceTime" },
    ]);
  });

  it("listAudioInputs 只取 audioinput", async () => {
    stubEnumerate([
      mkDevice("videoinput", "v1"),
      mkDevice("audioinput", "a1", ""),
      mkDevice("audioinput", "a2", "外接麦"),
    ]);
    expect(await listAudioInputs()).toEqual([
      { deviceId: "a1", label: "麦克风 1" },
      { deviceId: "a2", label: "外接麦" },
    ]);
  });

  it("无 enumerateDevices → 空列表(不抛错)", async () => {
    clearMediaDevices();
    expect(await listVideoInputs()).toEqual([]);
    expect(await listAudioInputs()).toEqual([]);
  });
});

describe("hasDeviceLabels", () => {
  afterEach(() => clearMediaDevices());

  it("label 为空(未授权)→ false", async () => {
    stubEnumerate([
      mkDevice("videoinput", "v1", ""),
      mkDevice("audioinput", "a1", ""),
    ]);
    expect(await hasDeviceLabels("video")).toBe(false);
    expect(await hasDeviceLabels("audio")).toBe(false);
  });

  it("有真实 label(已授权)→ true", async () => {
    stubEnumerate([
      mkDevice("videoinput", "v1", "FaceTime HD"),
      mkDevice("audioinput", "a1", ""),
    ]);
    expect(await hasDeviceLabels("video")).toBe(true);
    // 音频仍空
    expect(await hasDeviceLabels("audio")).toBe(false);
  });

  it("该类型无设备 → true(无需等待)", async () => {
    stubEnumerate([mkDevice("audioinput", "a1", "")]);
    expect(await hasDeviceLabels("video")).toBe(true);
  });
});

describe("reconcileDeviceId", () => {
  const devs = [{ deviceId: "v1" }, { deviceId: "v2" }];

  it("stored 仍在列表 → 保留", () => {
    expect(reconcileDeviceId("v1", devs)).toBe("v1");
  });

  it("stored 不在列表(stale)→ null 回退默认", () => {
    expect(reconcileDeviceId("gone", devs)).toBeNull();
  });

  it("stored null → null", () => {
    expect(reconcileDeviceId(null, devs)).toBeNull();
  });

  it("设备列表为空(未授权)→ 保留 stored(下次仍记偏好)", () => {
    expect(reconcileDeviceId("v1", [])).toBe("v1");
  });
});
