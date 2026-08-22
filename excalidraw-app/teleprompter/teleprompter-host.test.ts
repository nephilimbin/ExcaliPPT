// 宿主选择意图:独立置顶提词窗在三类环境下行为正确——
// 桌面壳 → 原生子窗(portalWindow 恒 null,子窗自渲染);
// Chrome/Edge → Document PiP(portal 进 PiP 窗,行为同重构前);
// 其余浏览器(如 Firefox)→ 无宿主,入口禁用。

import { selectTeleprompterHost } from "./teleprompter-host";

import type { ExcalipptDesktopBridge } from "../desktop-bridge";

describe("selectTeleprompterHost", () => {
  const originalBridge = window.__excalipptDesktop__;
  const originalPiP = (
    window as unknown as {
      documentPictureInPicture?: unknown;
    }
  ).documentPictureInPicture;

  const fakePiPWindow = (): Window => {
    const listeners: Record<string, (() => void)[]> = {};
    return {
      close: vi.fn(),
      addEventListener: vi.fn((type: string, cb: () => void) => {
        listeners[type] = [...(listeners[type] ?? []), cb];
      }),
      fire: (type: string) => (listeners[type] ?? []).forEach((cb) => cb()),
    } as unknown as Window;
  };

  afterEach(() => {
    if (originalBridge) {
      window.__excalipptDesktop__ = originalBridge;
    } else {
      delete window.__excalipptDesktop__;
    }
    const holder = window as unknown as {
      documentPictureInPicture?: unknown;
    };
    if (originalPiP === undefined) {
      delete holder.documentPictureInPicture;
    } else {
      holder.documentPictureInPicture = originalPiP;
    }
  });

  it("无桌面桥、不支持 Document PiP(如 Firefox)→ null(入口禁用)", () => {
    expect(selectTeleprompterHost()).toBe(null);
  });

  it("支持 Document PiP → 浏览器宿主,open 返回 PiP 窗供 portal,close 委托其 close()", async () => {
    const w = fakePiPWindow();
    (
      window as unknown as { documentPictureInPicture: unknown }
    ).documentPictureInPicture = {
      requestWindow: () => Promise.resolve(w),
    };

    const host = selectTeleprompterHost();
    expect(host?.kind).toBe("browser-pip");

    const handle = await host!.open();
    expect(handle?.portalWindow).toBe(w);
    handle!.close();
    expect(w.close).toHaveBeenCalled();
  });

  it("桌面壳 → electron 宿主优先(即便浏览器也有 PiP),portalWindow 恒 null", async () => {
    // 同时给 PiP:桌面桥必须赢,否则会在 Electron 里调不存在的 documentPictureInPicture
    (
      window as unknown as { documentPictureInPicture: unknown }
    ).documentPictureInPicture = { requestWindow: () => Promise.resolve({}) };

    const bridge: ExcalipptDesktopBridge = {
      platform: "darwin",
      teleprompter: {
        open: vi.fn(() => Promise.resolve(true)),
        close: vi.fn(),
        onClosed: vi.fn(),
      },
    };
    window.__excalipptDesktop__ = bridge;

    const host = selectTeleprompterHost();
    expect(host?.kind).toBe("electron");

    const handle = await host!.open();
    expect(bridge.teleprompter.open).toHaveBeenCalled();
    expect(handle?.portalWindow).toBe(null);
  });

  it("桌面桥 open 失败(返回 false)→ open() 返回 null", async () => {
    window.__excalipptDesktop__ = {
      platform: "win32",
      teleprompter: {
        open: () => Promise.resolve(false),
        close: () => {},
        onClosed: () => () => {},
      },
    };
    const host = selectTeleprompterHost();
    expect(await host!.open()).toBe(null);
  });

  it("electron 宿主 onClose 自退订:closed 触发后监听器从 ipcRenderer 移除,不随开关循环累积", async () => {
    // mock 忠实模拟 ipcRenderer.on/removeListener 语义:off 真正把监听器移出列表
    const listeners: Array<() => void> = [];
    const off = vi.fn();
    window.__excalipptDesktop__ = {
      platform: "darwin",
      teleprompter: {
        open: () => Promise.resolve(true),
        close: () => {},
        onClosed: (cb: () => void) => {
          listeners.push(cb);
          return () => {
            off();
            const i = listeners.indexOf(cb);
            if (i >= 0) {
              listeners.splice(i, 1);
            }
          };
        },
      },
    };
    const host = selectTeleprompterHost();
    const handle = await host!.open();
    const onClosed = vi.fn();
    handle!.onClose(onClosed);

    expect(listeners).toHaveLength(1);
    listeners[0](); // 首次 closed → 回调触发并自退订
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalled();
    // 已退订:ipcRenderer 不再持有该监听,后续 closed 事件不会重复送达
    expect(listeners).toHaveLength(0);
  });
});
