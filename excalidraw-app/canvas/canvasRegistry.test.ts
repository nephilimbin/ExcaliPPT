import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CANVAS_ID } from "../app_constants";

import {
  defaultName,
  deleteCanvas,
  deleteCanvases,
  formatRelative,
  reconcileCanvases,
  renameCanvas,
  scanCanvasIds,
  scoped,
} from "./canvasRegistry";

// deleteCanvas 现用 indexedDB.deleteDatabase 连库删除(连库壳一起消失,非 idb-keyval clear)
const deleteDbSpy = vi.spyOn(indexedDB, "deleteDatabase");

describe("canvasRegistry", () => {
  beforeEach(() => {
    localStorage.clear();
    deleteDbSpy.mockClear();
  });

  describe("scoped", () => {
    it("default 无后缀,scratch 带 :id", () => {
      expect(scoped("excalidraw", DEFAULT_CANVAS_ID)).toBe("excalidraw");
      expect(scoped("excalidraw", "abc")).toBe("excalidraw:abc");
      expect(scoped("files-db", "xyz")).toBe("files-db:xyz");
    });
  });

  describe("scanCanvasIds", () => {
    it("default 始终存在(即便无任何键)", () => {
      expect(scanCanvasIds()).toEqual(new Set([DEFAULT_CANVAS_ID]));
    });

    it("识别 default 与 scratch 的 elements/state 键", () => {
      localStorage.setItem("excalidraw", "[]");
      localStorage.setItem("excalidraw-state", "{}");
      localStorage.setItem("excalidraw:abc", "[]");
      localStorage.setItem("excalidraw-state:xyz", "{}");
      expect(scanCanvasIds()).toEqual(
        new Set([DEFAULT_CANVAS_ID, "abc", "xyz"]),
      );
    });

    it("不误判同名前缀的非画布键", () => {
      const noise = [
        "excalidraw-canvases",
        "excalidraw-meta",
        "excalidraw-meta:abc",
        "excalidraw-collab",
        "excalidraw-theme",
        "excalidraw-library",
        "excalidraw-debug",
        "excalidraw-state-collab",
      ];
      for (const key of noise) {
        localStorage.setItem(key, "x");
      }
      expect(scanCanvasIds()).toEqual(new Set([DEFAULT_CANVAS_ID]));
    });
  });

  describe("defaultName", () => {
    it("格式:画布 MM-DD HH:mm", () => {
      const ts = new Date(2026, 7, 12, 14, 30).getTime();
      expect(defaultName(ts)).toBe("画布 08-12 14:30");
    });
  });

  describe("reconcileCanvases", () => {
    it("补登 localStorage 新画布,剔除注册表中已删画布", () => {
      localStorage.setItem("excalidraw:abc", "[]");
      localStorage.setItem(
        "excalidraw-canvases",
        JSON.stringify([{ id: "gone", name: "已删", createdAt: 1000 }]),
      );

      const ids = reconcileCanvases().map((r) => r.id);
      expect(ids).toContain(DEFAULT_CANVAS_ID);
      expect(ids).toContain("abc");
      expect(ids).not.toContain("gone");
    });

    it("default 置顶,其余按 updatedAt 降序", () => {
      localStorage.setItem("excalidraw:a", "[]");
      localStorage.setItem("excalidraw:b", "[]");
      localStorage.setItem("excalidraw-meta:a", String(100));
      localStorage.setItem("excalidraw-meta:b", String(200));

      const records = reconcileCanvases();
      expect(records[0].id).toBe(DEFAULT_CANVAS_ID);
      expect(records[1].id).toBe("b");
      expect(records[2].id).toBe("a");
    });

    it("无 meta 时 updatedAt 回落 createdAt", () => {
      localStorage.setItem("excalidraw:a", "[]");
      localStorage.setItem(
        "excalidraw-canvases",
        JSON.stringify([{ id: "a", createdAt: 5000 }]),
      );
      const rec = reconcileCanvases().find((r) => r.id === "a")!;
      expect(rec.updatedAt).toBe(5000);
    });

    it("回写注册表(补登项持久化)", () => {
      localStorage.setItem("excalidraw:abc", "[]");
      reconcileCanvases();
      const raw = JSON.parse(localStorage.getItem("excalidraw-canvases")!) as {
        id: string;
        createdAt: number;
      }[];
      expect(raw.find((r) => r.id === "abc")).toBeTruthy();
    });

    it("保留用户自定义名,未命名项不持久化 name", () => {
      localStorage.setItem("excalidraw:abc", "[]");
      localStorage.setItem("excalidraw:def", "[]");
      localStorage.setItem(
        "excalidraw-canvases",
        JSON.stringify([{ id: "abc", name: "我的画布", createdAt: 1 }]),
      );
      reconcileCanvases();
      const raw = JSON.parse(localStorage.getItem("excalidraw-canvases")!) as {
        id: string;
        name?: string;
      }[];
      expect(raw.find((r) => r.id === "abc")?.name).toBe("我的画布");
      expect(raw.find((r) => r.id === "def")?.name).toBeUndefined();
    });
  });

  describe("renameCanvas", () => {
    it("持久化新名", () => {
      localStorage.setItem(
        "excalidraw-canvases",
        JSON.stringify([{ id: "abc", createdAt: 1 }]),
      );
      renameCanvas("abc", "新名字");
      const raw = JSON.parse(localStorage.getItem("excalidraw-canvases")!) as {
        id: string;
        name?: string;
      }[];
      expect(raw.find((r) => r.id === "abc")?.name).toBe("新名字");
    });

    it("空白名被忽略", () => {
      localStorage.setItem(
        "excalidraw-canvases",
        JSON.stringify([{ id: "abc", name: "原名", createdAt: 1 }]),
      );
      renameCanvas("abc", "   ");
      const raw = JSON.parse(localStorage.getItem("excalidraw-canvases")!) as {
        id: string;
        name?: string;
      }[];
      expect(raw.find((r) => r.id === "abc")?.name).toBe("原名");
    });

    it("补登尚未注册的 id", () => {
      renameCanvas("lonely", "孤狼");
      const raw = JSON.parse(localStorage.getItem("excalidraw-canvases")!) as {
        id: string;
        name?: string;
      }[];
      expect(raw.find((r) => r.id === "lonely")?.name).toBe("孤狼");
    });
  });

  describe("deleteCanvas", () => {
    it("清三处 localStorage 键 + IndexedDB + 注册表项", async () => {
      localStorage.setItem("excalidraw:abc", "[]");
      localStorage.setItem("excalidraw-state:abc", "{}");
      localStorage.setItem("excalidraw-meta:abc", "123");
      localStorage.setItem("excalidraw-teleprompter-draft:abc", "旧口播稿");
      localStorage.setItem("excalidraw-teleprompter-session:abc", "{}");
      localStorage.setItem(
        "excalidraw-canvases",
        JSON.stringify([
          { id: "abc", createdAt: 1 },
          { id: "keep", createdAt: 2 },
        ]),
      );

      await deleteCanvas("abc");

      expect(localStorage.getItem("excalidraw:abc")).toBeNull();
      expect(localStorage.getItem("excalidraw-state:abc")).toBeNull();
      expect(localStorage.getItem("excalidraw-meta:abc")).toBeNull();
      // R3:提词稿 + 会话也随画布删除而清(显式删画布清,不挂元素计数)
      expect(
        localStorage.getItem("excalidraw-teleprompter-draft:abc"),
      ).toBeNull();
      expect(
        localStorage.getItem("excalidraw-teleprompter-session:abc"),
      ).toBeNull();
      expect(deleteDbSpy).toHaveBeenCalledWith("files-db:abc");
      const raw = JSON.parse(localStorage.getItem("excalidraw-canvases")!) as {
        id: string;
      }[];
      expect(raw.map((r) => r.id)).toEqual(["keep"]);
    });

    it("default 不可删(无任何副作用)", async () => {
      localStorage.setItem("excalidraw", "[]");
      await deleteCanvas(DEFAULT_CANVAS_ID);
      expect(localStorage.getItem("excalidraw")).toBe("[]");
      expect(deleteDbSpy).not.toHaveBeenCalled();
    });
  });

  describe("deleteCanvases", () => {
    it("批量删除多个,跳过 default", async () => {
      localStorage.setItem("excalidraw:a", "[]");
      localStorage.setItem("excalidraw:b", "[]");
      localStorage.setItem("excalidraw", "[]");
      localStorage.setItem(
        "excalidraw-canvases",
        JSON.stringify([
          { id: "a", createdAt: 1 },
          { id: "b", createdAt: 2 },
          { id: DEFAULT_CANVAS_ID, createdAt: 0 },
        ]),
      );

      await deleteCanvases(["a", "b", DEFAULT_CANVAS_ID]);

      expect(localStorage.getItem("excalidraw:a")).toBeNull();
      expect(localStorage.getItem("excalidraw:b")).toBeNull();
      expect(localStorage.getItem("excalidraw")).toBe("[]");
      expect(deleteDbSpy).toHaveBeenCalledTimes(2);
      const raw = JSON.parse(localStorage.getItem("excalidraw-canvases")!) as {
        id: string;
      }[];
      expect(raw.map((r) => r.id)).toEqual([DEFAULT_CANVAS_ID]);
    });

    it("空数组无副作用", async () => {
      await deleteCanvases([]);
      expect(deleteDbSpy).not.toHaveBeenCalled();
    });
  });

  describe("formatRelative", () => {
    it("各档位", () => {
      const now = Date.now();
      expect(formatRelative(now)).toBe("刚刚");
      expect(formatRelative(now - 5 * 60 * 1000)).toBe("5 分钟前");
      expect(formatRelative(now - 3 * 60 * 60 * 1000)).toBe("3 小时前");
      expect(formatRelative(now - 2 * 24 * 60 * 60 * 1000)).toBe("2 天前");
      expect(formatRelative(0)).toBe("");
    });
  });
});
