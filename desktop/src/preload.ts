// preload:向渲染进程暴露最小桌面桥 window.__excalipptDesktop__。
// contextIsolation 开启:渲染进程拿不到 ipcRenderer / node 能力,只见到此桥。
// 桥的类型面必须与 excalidraw-app/desktop-bridge.ts 的 ExcalipptDesktopBridge 保持一致
// (字段名即契约,两侧同源维护)。

import { contextBridge, ipcRenderer } from "electron";

import { IPC, type UpdateStatus } from "./ipc-channels";

const bridge = {
  platform: process.platform,
  updates: {
    /** 手动触发检查更新(Win 状态经 onStatus 推送;mac 走原生弹窗给下载链接)。 */
    check: (): void => {
      ipcRenderer.send(IPC.checkForUpdates);
    },
    /** 重启并安装已下载的更新(主进程防重复守卫)。 */
    install: (): void => {
      ipcRenderer.send(IPC.installUpdate);
    },
    /** 订阅更新状态推送;返回取消订阅函数。 */
    onStatus: (cb: (status: UpdateStatus) => void): (() => void) => {
      const listener = (_e: unknown, status: UpdateStatus): void => cb(status);
      ipcRenderer.on(IPC.updateStatus, listener);
      return () => {
        ipcRenderer.removeListener(IPC.updateStatus, listener);
      };
    },
    /** 拉取最近一条更新状态(晚挂载窗口补偿纯推送漏掉的终态);无则为 null。 */
    status: (): Promise<UpdateStatus | null> =>
      ipcRenderer.invoke(IPC.getUpdateStatus),
  },
  teleprompter: {
    open: (): Promise<boolean> => ipcRenderer.invoke(IPC.teleprompterOpen),
    close: (): void => {
      ipcRenderer.send(IPC.teleprompterClose);
    },
    onClosed: (cb: () => void): (() => void) => {
      const listener = (): void => cb();
      ipcRenderer.on(IPC.teleprompterClosed, listener);
      return () => {
        ipcRenderer.removeListener(IPC.teleprompterClosed, listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld("__excalipptDesktop__", bridge);
