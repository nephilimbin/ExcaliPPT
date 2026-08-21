/**
 * 画布注册表 —— 扫描即真源(ADR-0003)。
 *
 * 画布存在性以 localStorage 的 `excalidraw:<id>` / `excalidraw-state:<id>` 键为准
 * (default 无后缀),本模块只在这些键之上做对账:补登新画布、剔除已删、
 * 维护用户自定义名 + createdAt。updatedAt 从 canvas-scoped 的 `excalidraw-meta:<id>`
 * 时间戳派生(随 LocalData 自动保存写入),注册表不靠生命周期 hook 维持,自愈不漂移。
 */
import { DEFAULT_CANVAS_ID, STORAGE_KEYS } from "../app_constants";
import { DRAFT_KEY, SESSION_KEY } from "../teleprompter/teleprompter-storage";

/** 全局画布注册表键(非 canvas-scoped) */
const CANVAS_REGISTRY_KEY = "excalidraw-canvases";
/** canvas-scoped 时间戳键(default: "excalidraw-meta",scratch: "excalidraw-meta:<id>") */
const CANVAS_META_BASE = "excalidraw-meta";

/** 持久注册表项(仅承载扫描派生不了的元数据:name + createdAt) */
interface PersistedCanvasRecord {
  id: string;
  name?: string;
  createdAt: number;
}

/** 运行时画布记录(含从 meta 派生的 updatedAt) */
export interface CanvasRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 与 app_constants.canvasScopedKey 同形,但按**参数 id** 拼接
 * (canvasScopedKey 读当前 URL,删/读非当前画布时不可用)。
 */
export const scoped = (base: string, id: string): string =>
  id === DEFAULT_CANVAS_ID ? base : `${base}:${id}`;

// `$` 结尾 + 紧跟 `:` —— 否则误匹配 excalidraw-state / excalidraw-meta /
// excalidraw-canvases / excalidraw-collab / excalidraw-theme / excalidraw-library 等键。
const ELEMENTS_RE = /^excalidraw(?::([a-zA-Z0-9_-]+))?$/;
const STATE_RE = /^excalidraw-state(?::([a-zA-Z0-9_-]+))?$/;

/** 枚举 localStorage,抽出所有画布 id(default 始终在内,永在) */
export const scanCanvasIds = (): Set<string> => {
  const ids = new Set<string>([DEFAULT_CANVAS_ID]);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) {
      continue;
    }
    const elementsMatch = key.match(ELEMENTS_RE);
    if (elementsMatch) {
      ids.add(elementsMatch[1] ?? DEFAULT_CANVAS_ID);
      continue;
    }
    const stateMatch = key.match(STATE_RE);
    if (stateMatch) {
      ids.add(stateMatch[1] ?? DEFAULT_CANVAS_ID);
    }
  }
  return ids;
};

const loadRegistry = (): PersistedCanvasRecord[] => {
  try {
    const raw = localStorage.getItem(CANVAS_REGISTRY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedCanvasRecord[]) : [];
  } catch {
    return [];
  }
};

const saveRegistry = (records: PersistedCanvasRecord[]): void => {
  try {
    localStorage.setItem(CANVAS_REGISTRY_KEY, JSON.stringify(records));
  } catch {
    // 隐私模式 / quota —— 忽略,扫描自愈会在下次对账
  }
};

/** 默认名:画布 MM-DD HH:mm */
export const defaultName = (createdAt: number): string => {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `画布 ${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

const readMeta = (id: string): number => {
  const raw = localStorage.getItem(scoped(CANVAS_META_BASE, id));
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : 0;
};

/**
 * 扫描即真源:对账 localStorage 与持久注册表。
 * 补登新发现的画布、剔除已删,回写注册表;返回排序后记录
 * (default 置顶,其余按 updatedAt 降序)。老画布无 meta 时 updatedAt 回落 createdAt。
 */
export const reconcileCanvases = (): CanvasRecord[] => {
  const liveIds = scanCanvasIds();
  const persisted = loadRegistry();
  const persistedMap = new Map(persisted.map((r) => [r.id, r]));

  const nextPersisted: PersistedCanvasRecord[] = [];
  const records: CanvasRecord[] = [];

  for (const id of liveIds) {
    const existing = persistedMap.get(id);
    const createdAt = existing?.createdAt ?? Date.now();
    const name = existing?.name ?? defaultName(createdAt);
    // 仅持久化用户自定义名(undefined 表示用默认名,下次再派生)
    nextPersisted.push({
      id,
      name: existing?.name,
      createdAt,
    });
    records.push({
      id,
      name,
      createdAt,
      updatedAt: readMeta(id) || createdAt,
    });
  }

  saveRegistry(nextPersisted);

  records.sort((a, b) => {
    if (a.id === DEFAULT_CANVAS_ID) {
      return -1;
    }
    if (b.id === DEFAULT_CANVAS_ID) {
      return 1;
    }
    return b.updatedAt - a.updatedAt;
  });
  return records;
};

/** 重命名(持久 name;default 也可改名,只是不可删) */
export const renameCanvas = (id: string, name: string): void => {
  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }
  const persisted = loadRegistry();
  const idx = persisted.findIndex((r) => r.id === id);
  if (idx >= 0) {
    persisted[idx] = { ...persisted[idx], name: trimmed };
  } else {
    // 注册表暂无此 id(尚未 reconcile 过)—— 补登
    persisted.push({ id, name: trimmed, createdAt: Date.now() });
  }
  saveRegistry(persisted);
};

/**
 * 删除整个 IndexedDB 数据库(连库一起删,不止清条目)。
 * clear() 只清空键值、库壳仍残留在 F12;deleteDatabase 才彻底消失。
 * 连接受阻(filesStore 占着当前画布)时请求挂起,导航卸载关闭连接后完成 → resolve 不阻塞调用方。
 */
const deleteIdbDatabase = (name: string): Promise<void> =>
  new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => {
      // eslint-disable-next-line no-console
      console.warn(
        `[canvasRegistry] deleteDatabase(${name}) failed`,
        req.error,
      );
      resolve();
    };
    req.onblocked = () => {
      // eslint-disable-next-line no-console
      console.warn(
        `[canvasRegistry] deleteDatabase(${name}) blocked(连接占用,导航卸载后完成)`,
      );
      resolve();
    };
  });

/**
 * 删除画布:清三处 localStorage 键 + IndexedDB files-db 库 + 注册表项。
 * default 不可删(直接返回);UI 亦不渲染删除按钮,双重防护。
 */
export const deleteCanvas = async (id: string): Promise<void> => {
  if (id === DEFAULT_CANVAS_ID) {
    return;
  }

  localStorage.removeItem(scoped(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS, id));
  localStorage.removeItem(scoped(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE, id));
  localStorage.removeItem(scoped(CANVAS_META_BASE, id));
  // R3:清该画布的提词稿 + 滚动会话(显式删画布时清,不挂元素计数 → 不复发撤销丢稿)
  localStorage.removeItem(scoped(DRAFT_KEY, id));
  localStorage.removeItem(scoped(SESSION_KEY, id));

  // 连库删掉(不止 clear 条目):删非当前画布立即完成;删当前画布时 filesStore
  // 连接受阻,handleDelete 随后导航卸载、连接关闭后完成。
  await deleteIdbDatabase(`files-db:${id}`);

  const persisted = loadRegistry().filter((r) => r.id !== id);
  saveRegistry(persisted);
};

/**
 * 批量删除:逐个清理(default 自动跳过、去重)。串行执行 IDB 清理,
 * 画布数通常很少,无需并行。
 */
export const deleteCanvases = async (ids: string[]): Promise<void> => {
  const targets = [...new Set(ids)].filter((id) => id !== DEFAULT_CANVAS_ID);
  for (const id of targets) {
    await deleteCanvas(id);
  }
};

/** 相对时间(中文):刚刚 / X 分钟前 / X 小时前 / X 天前;超过 7 天回落 MM-DD HH:mm */
export const formatRelative = (ts: number): string => {
  if (!ts) {
    return "";
  }
  const diff = Date.now() - ts;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) {
    return "刚刚";
  }
  if (diff < hour) {
    return `${Math.floor(diff / min)} 分钟前`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`;
  }
  if (diff < 7 * day) {
    return `${Math.floor(diff / day)} 天前`;
  }
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};
