# ExcaliPPT 桌面壳(Electron)

加载与 nginx **同一份** SPA 构建产物(`excalidraw-app/build`),完全离线运行。决策见 `docs/adr/0005-electron-desktop-shell.md`。

## 常用命令(根目录执行)

```bash
yarn desktop:build      # 构建 SPA + 编译主进程(不打包)
yarn desktop:start      # 构建并启动桌面应用
yarn desktop:smoke      # 冒烟:加载成功打 [desktop-smoke] OK 退出 0
yarn desktop:dist:mac   # 出 mac dmg(arm64 + x64,未签名)
yarn desktop:dist:win   # 交叉构建 Windows nsis x64(未签名)
yarn desktop:typecheck  # 仅类型检查
yarn desktop:release    # 双平台构建 → tag → GitHub Releases 草稿
```

开发时可指向 vite dev server:`EXCALIPPT_DEV_SERVER_URL=http://localhost:3001 yarn --cwd desktop start`

## 未签名首启(已接受的摩擦,不购买证书)

- **macOS**:双击 dmg 安装后首次打开被 Gatekeeper 拦 → **右键 App → 打开 → 再点「打开」**;或终端 `xattr -cr /Applications/ExcaliPPT.app`
- **Windows**:SmartScreen 拦 → 「更多信息」→ 「仍要运行」

## 更新

- 更新源 = 本仓库 GitHub Releases(public,零 token)
- **Windows**:自动检查 + 下载,提示重启安装
- **macOS**:菜单「帮助 → 检查更新…」,新版本给下载链接(未签名不能全自动,见 ADR-0005)

## 结构

- `src/main.ts` — 主进程:app:// 协议托管产物、主窗口状态持久化、提词器置顶子窗、更新器、`--smoke` 冒烟
- `src/preload.ts` — 向渲染进程注入 `window.__excalipptDesktop__` 桥(类型面见 `excalidraw-app/desktop-bridge.ts`)
- `src/ipc-channels.ts` — 主进程与 preload 的通道名契约(渲染进程不直接使用)

## 打包产物布局

SPA 构建产物经 electron-builder `extraResources` 落到 `resources/app`,主进程以 `app://` 协议托管(规避 `file://` 下绝对路径失效);字体离线走产物内 `fonts/` 本地回落。
