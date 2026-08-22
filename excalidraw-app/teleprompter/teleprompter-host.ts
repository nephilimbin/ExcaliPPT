// Teleprompter 宿主抽象:封装「打开一个独立置顶提词窗」的宿主差异,调用方(SlidesPanel)不感知实现。
// - 浏览器宿主(browser-pip):Document Picture-in-Picture(仅 Chrome/Edge 116+),
//   返回同源 Window,由主窗口 createPortal 把 <Teleprompter/> 挂进去(既有行为)。
// - 桌面宿主(electron):经 preload 桥请求主进程开 alwaysOnTop 子窗;
//   子窗口加载 ?teleprompter=1 独立路由自渲染(TeleprompterChild),portalWindow 为 null。
// 文稿 / 设置不经宿主同步:两者都存 localStorage,同源窗口(PiP 与 Electron 子窗均同源)天然共享。

import { getDesktopBridge } from "../desktop-bridge";

import {
  requestTeleprompterPiP,
  supportsDocumentPiP,
} from "./teleprompter-pip";

export type TeleprompterHostKind = "browser-pip" | "electron";

/** 打开后的提词窗句柄。 */
export interface TeleprompterWindowHandle {
  readonly kind: TeleprompterHostKind;
  /**
   * portal 目标 Window(浏览器宿主);桌面宿主为 null——子窗口自渲染,
   * 主窗口无需(也不能)portal。
   */
  readonly portalWindow: Window | null;
  /** 关闭提词窗(幂等)。 */
  close(): void;
  /** 用户 / 系统关闭窗口时回调(pagehide / 子窗 closed 事件)。 */
  onClose(cb: () => void): void;
}

/** 提词器宿主:open 失败(不支持 / 用户取消)返回 null。 */
export interface TeleprompterHost {
  readonly kind: TeleprompterHostKind;
  open(): Promise<TeleprompterWindowHandle | null>;
}

/** 按环境选宿主:桌面桥优先;其次 Document PiP;都不支持 → null(入口应禁用)。 */
export const selectTeleprompterHost = (): TeleprompterHost | null => {
  const bridge = getDesktopBridge();
  if (bridge) {
    return {
      kind: "electron",
      open: async () => {
        const ok = await bridge.teleprompter.open();
        if (!ok) {
          return null;
        }
        return {
          kind: "electron",
          portalWindow: null,
          close: () => bridge.teleprompter.close(),
          onClose: (cb) => {
            // 自退订:closed 触发即移除监听,防开关循环在 ipcRenderer 上累积泄漏
            const off = bridge.teleprompter.onClosed(() => {
              off();
              cb();
            });
          },
        };
      },
    };
  }
  if (supportsDocumentPiP()) {
    return {
      kind: "browser-pip",
      open: async () => {
        const w = await requestTeleprompterPiP();
        if (!w) {
          return null;
        }
        return {
          kind: "browser-pip",
          portalWindow: w,
          close: () => w.close(),
          onClose: (cb) => {
            w.addEventListener("pagehide", cb);
          },
        };
      },
    };
  }
  return null;
};
