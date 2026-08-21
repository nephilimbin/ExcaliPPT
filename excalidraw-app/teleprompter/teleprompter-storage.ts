// 提词器持久化:文稿 + 会话按画布隔离(canvasScopedKey),设置(速度/字号/镜像/形态/透明度)全局共享。
// 不进场景 / 不导出;换浏览器 / 清缓存即丢(预期)。

import { canvasScopedKey } from "../app_constants";

export interface TeleprompterSettings {
  /** 滚屏速率(px/s) */
  speed: number;
  /** 提词态字号(px) */
  fontSize: number;
  /** 编辑态字号(px,独立于提词态,各自管理) */
  editorFontSize: number;
  /** 镜像翻转(物理提词玻璃用) */
  mirror: boolean;
  /** 形态:"pip"=独立画中画窗口,"inline"=画布内可拖动浮窗 */
  displayMode: "pip" | "inline";
  /** 画布内模式背景透明度(0–100,越大越透,100=全透);pip 模式忽略 */
  bgTransparency: number;
  /** 背景色:dark=黑底白字;light=白底黑字(浅色画布上更清晰) */
  theme: "dark" | "light";
  /** 画布内浮窗位置(px);pip 模式忽略 */
  inlineX: number;
  inlineY: number;
  /** 画布内浮窗大小(px);pip 模式忽略 */
  inlineW: number;
  inlineH: number;
}

export const DEFAULT_SETTINGS: TeleprompterSettings = {
  speed: 80,
  fontSize: 64,
  editorFontSize: 20,
  mirror: false,
  displayMode: "pip",
  bgTransparency: 15,
  theme: "dark",
  inlineX: 64,
  inlineY: 64,
  inlineW: 480,
  inlineH: 320,
};

export const DRAFT_KEY = "excalidraw-teleprompter-draft";
const SETTINGS_KEY = "excalidraw-teleprompter-settings";

export const loadDraft = (): string => {
  try {
    return localStorage.getItem(canvasScopedKey(DRAFT_KEY)) ?? "";
  } catch {
    return "";
  }
};

export const saveDraft = (text: string): void => {
  try {
    localStorage.setItem(canvasScopedKey(DRAFT_KEY), text);
  } catch {
    // 隐私模式 / 配额:忽略
  }
};

/** 清空当前画布的口播稿(重置画布时调用)。 */
export const clearDraft = (): void => {
  try {
    localStorage.removeItem(canvasScopedKey(DRAFT_KEY));
  } catch {
    // 忽略
  }
};

export const loadSettings = (): TeleprompterSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<TeleprompterSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (settings: TeleprompterSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 忽略
  }
};

/** 合并写入:读最新 settings 覆盖 patch 字段。
 * 设置有多处写入方(SlidesPanel/Teleprompter),整体回写各自持有的旧快照会互相覆盖
 * (如 Teleprompter 改速度时把 SlidesPanel 刚写的 theme 覆盖回旧值)。 */
export const updateSettings = (patch: Partial<TeleprompterSettings>): void => {
  saveSettings({ ...loadSettings(), ...patch });
};

// --- 会话(滚动位置 + 模式):使关闭/重开窗口不丢失进度 ---

export type TeleprompterMode = "edit" | "prompt";

export interface TeleprompterSession {
  /** 滚动位置(px),重开时 seek 恢复 */
  offset: number;
  /** 编辑/提词模式 */
  mode: TeleprompterMode;
}

export const SESSION_KEY = "excalidraw-teleprompter-session";

export const loadSession = (): TeleprompterSession | null => {
  try {
    const raw = localStorage.getItem(canvasScopedKey(SESSION_KEY));
    return raw ? (JSON.parse(raw) as TeleprompterSession) : null;
  } catch {
    return null;
  }
};

export const saveSession = (session: TeleprompterSession): void => {
  try {
    localStorage.setItem(canvasScopedKey(SESSION_KEY), JSON.stringify(session));
  } catch {
    // 忽略
  }
};
