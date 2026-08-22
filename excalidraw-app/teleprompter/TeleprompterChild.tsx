// 桌面提词器子窗口的独立路由(?teleprompter=1):不挂主应用,仅渲染 Teleprompter。
// 文稿 / 会话按画布隔离存 localStorage,子窗与主窗同源共享(子窗 URL 带同一 ?canvas=);
// 主题经 SETTINGS_KEY 的 storage 事件跟随主窗口(录制分栏)改动,子窗内改动直接写存储。
// 窗口无边框(main.ts frame:false——网页端 Document PiP 的标题栏是浏览器强制的,桌面无此限制):
// 移动/关闭由 Teleprompter 自身的底部工具栏承担(nativeWindowDrag,与画布内浮窗手势一致)。

import { useEffect, useState } from "react";

import { Teleprompter } from "../components/Teleprompter";
import { getDesktopBridge } from "../desktop-bridge";

import {
  loadSettings,
  SETTINGS_KEY,
  updateSettings,
} from "./teleprompter-storage";

export const TeleprompterChild = () => {
  const [theme, setTheme] = useState<"dark" | "light">(
    () => loadSettings().theme,
  );

  useEffect(() => {
    // 无边框窗口在 Mission Control / Cmd+Tab 仍显示标题:标明身份(而非主应用的 ExcaliPPT)
    document.title = "ExcaliPPT 提词器";
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) {
        setTheme(loadSettings().theme);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <Teleprompter
      theme={theme}
      onThemeChange={(t) => {
        updateSettings({ theme: t });
        setTheme(t);
      }}
      nativeWindowDrag
      onCloseWindow={() => getDesktopBridge()?.teleprompter.close()}
    />
  );
};
