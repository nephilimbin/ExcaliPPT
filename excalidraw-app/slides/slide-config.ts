// 幻灯片配置两层持久化(Issue 05)。
// - Default Slide Config:全局 localStorage 键(非 canvas-scoped),「保存为默认」写入,新画布继承。
// - Canvas Slide Config:canvasScopedKey() 画布级,覆盖 Default。
// - Effective = Canvas ?? Default ?? 出厂默认(16:9 / 1920×1080)。
// 详见 CONTEXT.md。纯函数(localStorage 注入),可独立单测。

import { canvasScopedKey } from "../app_constants";

import {
  DEFAULT_PRESET_ID,
  getPreset,
  type AspectPreset,
} from "./aspect-preset";
import { type SlideDirection } from "./slide-factory";

export interface SlideConfig {
  presetId: string;
  width: number;
  height: number;
  /** 第一张 frame 中心 x(canvas);省略 → 用顶部工具栏中间(动态) */
  startX?: number;
  /** 第一张 frame 中心 y(canvas);省略 → 工具栏下方(动态) */
  startY?: number;
  /** frame 之间的间距(canvas 单位) */
  gap: number;
  /** 排列方向;getEffectiveConfig 保证非空(旧数据无此字段时归一化为 horizontal)。 */
  direction: SlideDirection;
  /** 选中幻灯片时的默认显示比例(1 = 100%);省略 → 1。 */
  zoom?: number;
}

/** 全局默认配置键(非 canvas-scoped)。 */
const DEFAULT_STORAGE_KEY = "excalidraw-slides-default-config";
/** 画布级配置键基名(经 canvasScopedKey 拼上 canvasId)。 */
const CANVAS_STORAGE_BASE = "excalidraw-slides-canvas-config";

/** 出厂默认配置:16:9 / 1920×1080 / 起点 0,0 / 间距 100。 */
export const DEFAULT_CONFIG: SlideConfig = {
  presetId: DEFAULT_PRESET_ID,
  width: getPreset(DEFAULT_PRESET_ID).width,
  height: getPreset(DEFAULT_PRESET_ID).height,
  startX: 0,
  startY: 0,
  gap: 100,
  direction: "horizontal",
  zoom: 1,
};

const isSlideConfig = (v: unknown): v is SlideConfig =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as SlideConfig).presetId === "string" &&
  typeof (v as SlideConfig).width === "number" &&
  typeof (v as SlideConfig).height === "number" &&
  typeof (v as SlideConfig).gap === "number" &&
  ((v as SlideConfig).direction === undefined ||
    (v as SlideConfig).direction === "horizontal" ||
    (v as SlideConfig).direction === "vertical") &&
  ((v as SlideConfig).zoom === undefined ||
    typeof (v as SlideConfig).zoom === "number");

const readConfig = (key: string): SlideConfig | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return isSlideConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeConfig = (key: string, config: SlideConfig): void => {
  try {
    localStorage.setItem(key, JSON.stringify(config));
  } catch {
    // 忽略:隐私模式 / 配额满 / 不可用。
  }
};

/** 读全局默认配置(跨画布共享)。 */
export const loadDefaultConfig = (): SlideConfig | null =>
  readConfig(DEFAULT_STORAGE_KEY);

/** 「保存为默认」:写全局默认配置。 */
export const saveDefaultConfig = (config: SlideConfig): void =>
  writeConfig(DEFAULT_STORAGE_KEY, config);

/** 读当前画布配置(覆盖默认)。 */
export const loadCanvasConfig = (): SlideConfig | null =>
  readConfig(canvasScopedKey(CANVAS_STORAGE_BASE));

/** 画布内改配置(不「保存为默认」)→ 写当前画布。 */
export const saveCanvasConfig = (config: SlideConfig): void =>
  writeConfig(canvasScopedKey(CANVAS_STORAGE_BASE), config);

/**
 * 生效配置:Canvas 覆盖 Default,两者皆无回退出厂默认。
 * Canvas 配置是完整的(画布内改总是整体写),故整体优先级 Canvas > Default > 出厂。
 */
export const getEffectiveConfig = (): SlideConfig => {
  const cfg = loadCanvasConfig() ?? loadDefaultConfig() ?? DEFAULT_CONFIG;
  // 旧持久化数据可能无 direction 字段 → 归一化为 horizontal(单一兜底入口)
  return { ...cfg, direction: cfg.direction ?? "horizontal" };
};

// ── 自定义预设(Issue 06)─────────────────────────────────────────────
// 自定义预设属 Default Slide Config 范畴:全局键(非 canvas-scoped),跨画布共享。
// 实现上独立一个全局键,与默认配置键分开(均非 canvas-scoped,语义等价)。

const CUSTOM_PRESETS_KEY = "excalidraw-slides-custom-presets";

const isAspectPreset = (v: unknown): v is AspectPreset =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as AspectPreset).id === "string" &&
  typeof (v as AspectPreset).label === "string" &&
  typeof (v as AspectPreset).width === "number" &&
  typeof (v as AspectPreset).height === "number";

/** 读全局自定义预设列表(跨画布共享)。 */
export const loadCustomPresets = (): AspectPreset[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAspectPreset) : [];
  } catch {
    return [];
  }
};

/** 写全局自定义预设列表。 */
export const saveCustomPresets = (presets: AspectPreset[]): void => {
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // 忽略:隐私模式 / 配额满 / 不可用。
  }
};

/**
 * 追加(或按 id 覆盖)一个自定义预设,返回新列表(Issue 06)。
 * 首期只支持新增;同 id 覆盖等价于更新。
 */
export const upsertCustomPreset = (preset: AspectPreset): AspectPreset[] => {
  const next = [
    ...loadCustomPresets().filter((p) => p.id !== preset.id),
    preset,
  ];
  saveCustomPresets(next);
  return next;
};
