import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import { shouldRegisterServiceWorker } from "./desktop-bridge";
import ExcalidrawApp from "./App";
import { TeleprompterChild } from "./teleprompter/TeleprompterChild";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
// 桌面提词器子窗(?teleprompter=1):只渲染提词器,不挂主应用、不注册 SW。
const isTeleprompterChild =
  new URLSearchParams(window.location.search).get("teleprompter") === "1";
if (!isTeleprompterChild && shouldRegisterServiceWorker()) {
  registerSW();
}
root.render(
  <StrictMode>
    {isTeleprompterChild ? <TeleprompterChild /> : <ExcalidrawApp />}
  </StrictMode>,
);
