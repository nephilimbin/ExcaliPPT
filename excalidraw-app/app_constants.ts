// time constants (ms)
export const SAVE_TO_LOCAL_STORAGE_TIMEOUT = 300;
export const INITIAL_SCENE_UPDATE_TIMEOUT = 5000;
export const FILE_UPLOAD_TIMEOUT = 300;
export const LOAD_IMAGES_TIMEOUT = 500;
export const SYNC_FULL_SCENE_INTERVAL_MS = 20000;
export const SYNC_BROWSER_TABS_TIMEOUT = 50;
export const CURSOR_SYNC_TIMEOUT = 33; // ~30fps
export const DELETED_ELEMENT_TIMEOUT = 24 * 60 * 60 * 1000; // 1 day

// should be aligned with MAX_ALLOWED_FILE_BYTES
export const FILE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // 4 MiB
// 1 year (https://stackoverflow.com/a/25201898/927631)
export const FILE_CACHE_MAX_AGE_SEC = 31536000;

export const WS_EVENTS = {
  SERVER_VOLATILE: "server-volatile-broadcast",
  SERVER: "server-broadcast",
  USER_FOLLOW_CHANGE: "user-follow",
  USER_FOLLOW_ROOM_CHANGE: "user-follow-room-change",
} as const;

export enum WS_SUBTYPES {
  INVALID_RESPONSE = "INVALID_RESPONSE",
  INIT = "SCENE_INIT",
  UPDATE = "SCENE_UPDATE",
  MOUSE_LOCATION = "MOUSE_LOCATION",
  IDLE_STATUS = "IDLE_STATUS",
  USER_VISIBLE_SCENE_BOUNDS = "USER_VISIBLE_SCENE_BOUNDS",
}

export const FIREBASE_STORAGE_PREFIXES = {
  shareLinkFiles: `/files/shareLinks`,
  collabFiles: `/files/rooms`,
};

export const ROOM_ID_BYTES = 10;

export const STORAGE_KEYS = {
  LOCAL_STORAGE_ELEMENTS: "excalidraw",
  LOCAL_STORAGE_APP_STATE: "excalidraw-state",
  LOCAL_STORAGE_COLLAB: "excalidraw-collab",
  LOCAL_STORAGE_THEME: "excalidraw-theme",
  LOCAL_STORAGE_DEBUG: "excalidraw-debug",
  VERSION_DATA_STATE: "version-dataState",
  VERSION_FILES: "version-files",

  IDB_LIBRARY: "excalidraw-library",
  IDB_TTD_CHATS: "excalidraw-ttd-chats",

  // do not use apart from migrations
  __LEGACY_LOCAL_STORAGE_LIBRARY: "excalidraw-library",
} as const;

export const CANVAS_QUERY_PARAM = "canvas";
export const DEFAULT_CANVAS_ID = "default";

/** 从 ?canvas= 读取画布 ID,清洗非法字符(防注入 key),缺省返回 "default" */
export const getCanvasId = (): string => {
  try {
    const id = new URLSearchParams(window.location.search).get(
      CANVAS_QUERY_PARAM,
    );
    if (id) {
      return (
        id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || DEFAULT_CANVAS_ID
      );
    }
  } catch {
    // ignore
  }
  return DEFAULT_CANVAS_ID;
};

/** 默认画布返回原 key(向后兼容),其他画布返回 `base:canvasId` */
export const canvasScopedKey = (base: string): string => {
  const id = getCanvasId();
  return id === DEFAULT_CANVAS_ID ? base : `${base}:${id}`;
};

/** 生成新的随机画布 ID,符合 getCanvasId 的清洗规则 [a-zA-Z0-9_-]、≤64 字符 */
export const generateCanvasId = (): string => {
  return Math.random().toString(36).slice(2, 10); // 8 位 base36,碰撞概率极低
};

export const COOKIES = {
  AUTH_STATE_COOKIE: "excplus-auth",
} as const;
