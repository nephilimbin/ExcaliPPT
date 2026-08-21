import { describe, it, expect, beforeEach } from "vitest";

import {
  clearDraft,
  DEFAULT_SETTINGS,
  loadDraft,
  loadSession,
  loadSettings,
  saveDraft,
  saveSession,
  saveSettings,
  updateSettings,
} from "./teleprompter-storage";

describe("teleprompter-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("文稿往返", () => {
    expect(loadDraft()).toBe("");
    saveDraft("大家好,欢迎收看");
    expect(loadDraft()).toBe("大家好,欢迎收看");
  });

  it("clearDraft 清空当前画布文稿", () => {
    saveDraft("待清除的口播稿");
    expect(loadDraft()).toBe("待清除的口播稿");
    clearDraft();
    expect(loadDraft()).toBe("");
  });

  it("设置往返", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    saveSettings({
      speed: 120,
      fontSize: 80,
      editorFontSize: 24,
      mirror: true,
      displayMode: "inline",
      bgTransparency: 50,
      theme: "light",
      inlineX: 10,
      inlineY: 20,
      inlineW: 500,
      inlineH: 400,
    });
    expect(loadSettings()).toEqual({
      speed: 120,
      fontSize: 80,
      editorFontSize: 24,
      mirror: true,
      displayMode: "inline",
      bgTransparency: 50,
      theme: "light",
      inlineX: 10,
      inlineY: 20,
      inlineW: 500,
      inlineH: 400,
    });
  });

  it("updateSettings 合并写入,不覆盖未传字段", () => {
    // 意图:Teleprompter 只改 speed 时,不得把 SlidesPanel 刚写入的
    // theme/bgTransparency 用旧快照覆盖回去(否则重开后设置丢失)
    saveSettings({ ...DEFAULT_SETTINGS, theme: "light", bgTransparency: 80 });
    updateSettings({ speed: 120 });
    const s = loadSettings();
    expect(s.speed).toBe(120);
    expect(s.theme).toBe("light");
    expect(s.bgTransparency).toBe(80);
  });

  it("部分字段缺失 → 与默认合并", () => {
    localStorage.setItem(
      "excalidraw-teleprompter-settings",
      JSON.stringify({ mirror: true }),
    );
    const s = loadSettings();
    expect(s.mirror).toBe(true);
    expect(s.speed).toBe(DEFAULT_SETTINGS.speed);
    expect(s.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });

  it("非法 JSON → 回退默认(不抛错)", () => {
    localStorage.setItem("excalidraw-teleprompter-settings", "{broken");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("清空后恢复默认/空", () => {
    saveDraft("x");
    saveSettings({
      speed: 1,
      fontSize: 1,
      editorFontSize: 1,
      mirror: false,
      displayMode: "inline",
      bgTransparency: 40,
      theme: "dark",
      inlineX: 0,
      inlineY: 0,
      inlineW: 320,
      inlineH: 240,
    });
    localStorage.clear();
    expect(loadDraft()).toBe("");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("teleprompter 会话(位置 + 模式)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadSession 初始为 null", () => {
    expect(loadSession()).toBeNull();
  });

  it("saveSession / loadSession 往返", () => {
    saveSession({ offset: 123.4, mode: "prompt" });
    expect(loadSession()).toEqual({ offset: 123.4, mode: "prompt" });
  });

  it("非法 JSON → 回退 null(不抛错)", () => {
    localStorage.setItem("excalidraw-teleprompter-session", "{broken");
    expect(loadSession()).toBeNull();
  });
});

describe("teleprompter 文稿/会话按画布隔离", () => {
  const setCanvas = (id: string) =>
    window.history.pushState({}, "", id === "default" ? "/" : `/?canvas=${id}`);

  beforeEach(() => {
    localStorage.clear();
    setCanvas("default");
  });

  it("不同 ?canvas= 的文稿互相隔离", () => {
    setCanvas("a");
    saveDraft("画布A的稿");
    setCanvas("b");
    expect(loadDraft()).toBe("");
    saveDraft("画布B的稿");
    setCanvas("a");
    expect(loadDraft()).toBe("画布A的稿");
  });

  it("不同 ?canvas= 的会话互相隔离", () => {
    setCanvas("a");
    saveSession({ offset: 10, mode: "prompt" });
    setCanvas("b");
    expect(loadSession()).toBeNull();
    saveSession({ offset: 99, mode: "edit" });
    setCanvas("a");
    expect(loadSession()).toEqual({ offset: 10, mode: "prompt" });
  });

  it("设置(速度/字号/镜像)跨画布共享(全局)", () => {
    setCanvas("a");
    saveSettings({
      speed: 1,
      fontSize: 2,
      editorFontSize: 3,
      mirror: true,
      displayMode: "inline",
      bgTransparency: 60,
      theme: "light",
      inlineX: 5,
      inlineY: 6,
      inlineW: 640,
      inlineH: 480,
    });
    setCanvas("b");
    expect(loadSettings()).toEqual({
      speed: 1,
      fontSize: 2,
      editorFontSize: 3,
      mirror: true,
      displayMode: "inline",
      bgTransparency: 60,
      theme: "light",
      inlineX: 5,
      inlineY: 6,
      inlineW: 640,
      inlineH: 480,
    });
  });
});
