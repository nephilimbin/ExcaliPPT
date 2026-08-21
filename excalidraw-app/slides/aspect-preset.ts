// 幻灯片比例预设。纯函数模块,可独立单测。
// 详见 CONTEXT.md / ADR-0001(Slide ≡ Frame)。

import type { TranslationKeys } from "@excalidraw/excalidraw/i18n";

export interface AspectPreset {
  id: string;
  label: string;
  /** 需 i18n 翻译的显示文案路径;缺省时直接用 label(语言无关字面量,如 "16:9") */
  labelKey?: TranslationKeys;
  /** 基准分辨率宽(= frame 内容尺寸宽,所见即所得) */
  width: number;
  /** 基准分辨率高 */
  height: number;
  /** 是否锁定比例(改宽→高按比例联动)。出厂预设 true;「自定义」false,宽高可独立调整。 */
  locked: boolean;
}

/** 出厂预设清单。出厂预设锁定联动(Issue 04);末尾「自定义」不锁定(Issue 06+ 扩展)。 */
export const BUILTIN_PRESETS: readonly AspectPreset[] = [
  { id: "16:9", label: "16:9", width: 1920, height: 1080, locked: true },
  { id: "9:16", label: "9:16", width: 1080, height: 1920, locked: true },
  { id: "4:3", label: "4:3", width: 1440, height: 1080, locked: true },
  { id: "3:4", label: "3:4", width: 1080, height: 1440, locked: true },
  { id: "1:1", label: "1:1", width: 1080, height: 1080, locked: true },
  {
    id: "custom",
    label: "Custom",
    labelKey: "labels.slidesCustom",
    width: 1920,
    height: 1080,
    locked: false,
  },
];

/** 出厂默认选中。可被 Default Slide Config 覆盖(Issue 05)。 */
export const DEFAULT_PRESET_ID = "16:9";

/** 按 id 取预设;找不到回退默认(默认一定存在)。 */
export const getPreset = (id: string): AspectPreset =>
  BUILTIN_PRESETS.find((p) => p.id === id) ?? getPreset(DEFAULT_PRESET_ID);

/**
 * 改长 → 按预设比例算高(锁定联动):height = width ÷(w/h)。
 * 比例由预设定,换算后不可破坏。非法输入(≤0 / NaN / Infinity)回退基准高。
 * 仅对 locked 预设调用;「自定义」预设不调用(宽高独立)。
 */
export const heightFromWidth = (
  width: number,
  preset: AspectPreset,
): number => {
  if (!Number.isFinite(width) || width <= 0) {
    return preset.height;
  }
  return Math.round(width / (preset.width / preset.height));
};

/**
 * 改高 → 按预设比例算长(锁定联动):width = height ×(w/h)。
 * 比例由预设定。非法输入回退基准长。仅对 locked 预设调用。
 */
export const widthFromHeight = (
  height: number,
  preset: AspectPreset,
): number => {
  if (!Number.isFinite(height) || height <= 0) {
    return preset.width;
  }
  return Math.round(height * (preset.width / preset.height));
};

/** 出厂 + 自定义预设(Issue 06)。自定义在后,下拉中显示出厂再显示自定义。 */
export const getAllPresets = (
  customs: readonly AspectPreset[] = [],
): AspectPreset[] => [...BUILTIN_PRESETS, ...customs];

/**
 * 在出厂 + 自定义中按 id 查(Issue 06);找不到回退默认出厂预设。
 * 用于选预设后判断是否锁定联动(locked 字段)。
 */
export const findPreset = (
  id: string,
  customs: readonly AspectPreset[] = [],
): AspectPreset =>
  getAllPresets(customs).find((p) => p.id === id) ??
  findPreset(DEFAULT_PRESET_ID, customs);
