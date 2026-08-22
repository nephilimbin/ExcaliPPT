# 桌面版:Electron 壳(而非 Tauri);单一构建产物;GitHub Releases 更新

## 背景

需要 Windows + macOS 桌面版,硬约束「不影响现有 Docker 服务器部署」。动机(2026-08-21 grill 会话确认):离线/无服务器使用、原生体验、Teleprompter 摆脱 Document PiP 的浏览器依赖;**数据持久化非重点**(沿用浏览器 localStorage/IndexedDB 模型,不引入文件存储层)。

技术事实:

- 构建产物为**纯静态 SPA**(Docker 内 nginx 托管,零 Node 运行时),可直接打进桌面壳离线加载。
- **Recording** 依赖 `MediaRecorder + getUserMedia + canvas.captureStream` 三件套(`excalidraw-app/recording/recorder.ts` 的 `canRecord` 门禁),缺一即**静默禁用**。其中 `HTMLCanvasElement.captureStream` 在 WKWebView(Safari 引擎)**不存在**。
- **Teleprompter** 依赖 `documentPictureInPicture`(`excalidraw-app/teleprompter/teleprompter-pip.ts`),该 API 在 Electron 与各系统 WebView 均**不可用**——桌面版提词器无论选什么壳都要换原生置顶窗口实现,工作量相等。

## 决策

**Electron。** 决定性因素:Tauri 的 macOS 侧是 WKWebView,`canvas.captureStream` 缺失 → Recording 静默失效,核心功能 regression;Electron 双 OS 打包同一 Chromium,与现有 Chrome/Edge 目标环境行为一致,Recording / 提词器 / 字体全套 API 单引擎验证。代价(安装包 ~100-200MB、内存 VS Code 量级)对创作型桌面工具可接受。

**提词器桌面路径**:主进程开 `alwaysOnTop` BrowserWindow,文稿经 IPC 同步,领域行为不变(Teleprompter 定义已泛化为「独立置顶小窗,机制随宿主环境」,见 [CONTEXT.md](../../CONTEXT.md))。

配套决策(同会话定,互为依赖):

- **单一构建产物**:同一份 `excalidraw-app` build 既被 nginx 托管也打进 Electron;桌面判定走**运行时检测**(preload 注入全局标志),不设第二套构建管线 → `Dockerfile` / compose / `yarn start` 零改动。
- 桌面版**隐藏 AI 入口**(不烘 `VITE_APP_AI_BACKEND`);桌面**跳过 service worker 注册**;离线字体靠既有 `EXCALIDRAW_ASSET_PATH` 本地回落,打包时验证默认字体本地可解析。
- **更新**:仓库转 public,GitHub Releases 作 electron-updater feed(**零 token**);Win 全自动下载安装,Mac 检查+给下载链接(半自动);不购买签名证书。
- v1 含记住窗口状态;**不做**文件关联(.excalidraw 双击打开),后续迭代。

## 备选方案(已否决)

- **Tauri**:包体 ~10MB、内存低,但 macOS 用 WKWebView:`canvas.captureStream` 不存在 → Recording 在 Mac 上被 `canRecord` 门禁静默禁用;Win(WebView2)与 Mac(WKWebView)两套渲染引擎行为漂移,测试面翻倍。核心功能不可牺牲,否决。
- **仅优化 PWA,不加壳**:PWA manifest 已有 `display: standalone` + `file_handlers`,零开发量;但解不了 Document PiP 依赖 Chrome 内核的问题,且 Win/Mac 默认浏览器引擎不可控,否决。
- **双平台全自动更新**:macOS Squirrel.Mac 强制代码签名(需 Apple 开发者账号 $99/年 + 公证),个人项目成本不成比例;Mac 降级为检查+下载链接。
- **自有服务器作更新源**:需改 Docker 镜像/挂卷(违背「不影响服务器部署」),且外部机器须可达该服务器,否决。

## 后果

- 桌面 App 数据存 Electron userData,**与 localhost:3100 浏览器数据互为孤岛**——与「数据持久化非重点」一致;搬运走 .excalidraw 文件导出/导入。
- 未签名:Win 首次安装过 SmartScreen「仍要运行」;Mac 首次右键打开。
- 仓库由私有转 public(换取 Releases 免 token 化);桌面构建产物无秘密(AI 不烘入、Sentry 禁用)。
- Mac 本机交叉构建双平台安装包(electron-builder `--win nsis` unsigned 可用)。
- 与 `Slide ≡ Frame`([ADR-0001](./0001-slide-equals-frame.md))、提词器([ADR-0002](./0002-teleprompter-separate-window.md))、画布管理([ADR-0003](./0003-canvas-management.md))、录制([ADR-0004](./0004-recording-native-render.md))均正交:壳层增量,不改领域模型。
