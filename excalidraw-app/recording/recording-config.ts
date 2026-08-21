// Slice 2: 录制配置两层持久化(镜像 slide-config.ts)。
// - Default Recording Config:全局 localStorage 键(非 canvas-scoped),跨画布共享。
// - Canvas Recording Config:canvasScopedKey() 画布级,覆盖 Default。
// - Effective = Canvas ?? Default ?? 出厂默认。纯函数(localStorage 注入),可独立单测。

import { canvasScopedKey } from "../app_constants";

export interface RecordingConfig {
  cameraEnabled: boolean;
  /** 占 slide 宽度百分比,范围 8–30。 */
  cameraSizePct: number;
  cameraShape: "circle" | "square";
  /** 气泡中心,归一化 0..1(slide 宽)。 */
  cameraX: number;
  /** 气泡中心,归一化 0..1(slide 高)。 */
  cameraY: number;
  cameraDeviceId: string | null;
  micEnabled: boolean;
  micDeviceId: string | null;
  /** 录制指针开关。 */
  pointerEnabled: boolean;
}

/** 全局默认配置键(非 canvas-scoped)。 */
const DEFAULT_STORAGE_KEY = "excalidraw-recording-default-config";
/** 画布级配置键基名(经 canvasScopedKey 拼上 canvasId)。 */
const CANVAS_STORAGE_BASE = "excalidraw-recording-canvas-config";

/** 出厂默认:摄像头关 / 圆形 / 15% / 右下(0.82) / 指针开。 */
export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
  cameraEnabled: false,
  cameraSizePct: 15,
  cameraShape: "circle",
  cameraX: 0.82,
  cameraY: 0.82,
  cameraDeviceId: null,
  micEnabled: false,
  micDeviceId: null,
  pointerEnabled: true,
};

export const isRecordingConfig = (v: unknown): v is RecordingConfig => {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const c = v as Partial<RecordingConfig>;
  return (
    typeof c.cameraEnabled === "boolean" &&
    typeof c.cameraSizePct === "number" &&
    (c.cameraShape === "circle" || c.cameraShape === "square") &&
    typeof c.cameraX === "number" &&
    typeof c.cameraY === "number" &&
    (c.cameraDeviceId === null || typeof c.cameraDeviceId === "string") &&
    typeof c.micEnabled === "boolean" &&
    (c.micDeviceId === null || typeof c.micDeviceId === "string") &&
    typeof c.pointerEnabled === "boolean"
  );
};

const readConfig = (key: string): RecordingConfig | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return isRecordingConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeConfig = (key: string, config: RecordingConfig): void => {
  try {
    localStorage.setItem(key, JSON.stringify(config));
  } catch {
    // 忽略:隐私模式 / 配额满 / 不可用。
  }
};

/** 读全局默认录制配置(跨画布共享)。 */
export const loadDefaultRecordingConfig = (): RecordingConfig | null =>
  readConfig(DEFAULT_STORAGE_KEY);

/** 「保存为默认」:写全局默认录制配置。 */
export const saveDefaultRecordingConfig = (config: RecordingConfig): void =>
  writeConfig(DEFAULT_STORAGE_KEY, config);

/** 读当前画布录制配置(覆盖默认)。 */
export const loadCanvasRecordingConfig = (): RecordingConfig | null =>
  readConfig(canvasScopedKey(CANVAS_STORAGE_BASE));

/** 画布内改录制配置(不「保存为默认」)→ 写当前画布。 */
export const saveCanvasRecordingConfig = (config: RecordingConfig): void =>
  writeConfig(canvasScopedKey(CANVAS_STORAGE_BASE), config);

/**
 * 生效配置:Canvas 覆盖 Default,两者皆无回退出厂。
 * 用默认补齐缺失字段(防旧/部分数据)。
 */
export const getEffectiveRecordingConfig = (): RecordingConfig => {
  const cfg =
    loadCanvasRecordingConfig() ??
    loadDefaultRecordingConfig() ??
    DEFAULT_RECORDING_CONFIG;
  return { ...DEFAULT_RECORDING_CONFIG, ...cfg };
};
