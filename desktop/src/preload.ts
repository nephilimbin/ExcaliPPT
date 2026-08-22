// preload:向渲染进程暴露最小桌面桥 window.__excalipptDesktop__。
// contextIsolation 开启:渲染进程拿不到 ipcRenderer / node 能力,只见到此桥。
// 桥的类型面必须与 excalidraw-app/desktop-bridge.ts 的 ExcalipptDesktopBridge 保持一致
// (字段名即契约,两侧同源维护)。

import { contextBridge, ipcRenderer } from "electron";

import { IPC } from "./ipc-channels";

const bridge = {
  platform: process.platform,
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
