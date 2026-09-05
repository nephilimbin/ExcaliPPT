# ExcaliPPT

基于 [Excalidraw](https://github.com/excalidraw/excalidraw) 二次开发的画布演示工具——用白板的自由度,做幻灯片的事。

## 本仓库增加的功能

在 Excalidraw 完整画图能力之上,面向「画布 → 演示」场景的增强:

- **幻灯片(Slide)**:批量创建预设尺寸(默认 16:9 / 1920×1080)的 Frame 作为幻灯片,右侧导航面板聚焦切换
- **多画布**:单端口多画布(`?canvas=<id>`),主菜单「画布管理」支持新建 / 重命名 / 删除
- **口播提词器**:Document PiP 始终置顶小窗,大字号自动滚屏,与画面互不干扰
- **幻灯片录制**:按幻灯片目标分辨率离屏渲染导出视频,可选摄像头 / 麦克风 / 录制指针
- **激光笔与演示标注**、文字字号滑块等细节增强

## 快速开始

```bash
yarn install
yarn start        # dev server,http://localhost:3001
```

- Docker 部署(端口 3100)见 [DEPLOYMENT.md](./DEPLOYMENT.md)
- 开发 / 测试 / 端口约定见 [CLAUDE.md](./CLAUDE.md),领域词汇见 [CONTEXT.md](./CONTEXT.md),架构决策见 [docs/adr/](./docs/adr/)

## 桌面版安装包

产物命名统一为 `ExcaliPPT_<版本>_<系统>_<架构>`(如 `ExcaliPPT_0.1.0_macOS_arm64.dmg`),构建命令与产物布局见 [desktop/README.md](./desktop/README.md)。

### 系统要求(售卖说明可直接引用)

- **Windows**:Windows 10 及以上(64 位);不支持 Win 7/8/8.1 与 32 位
- **macOS**:12 (Monterey) 及以上(Intel 与 Apple Silicon 各出一个 dmg;依据打包产物 `Info.plist` 的 `LSMinimumSystemVersion`)

### 首次安装提示(未购买签名证书,属正常现象)

- **Windows**:SmartScreen 弹窗 → 「更多信息」→「仍要运行」
- **macOS**:系统设置 → 隐私与安全性 →「仍要打开」(macOS 15+;更旧系统可右键 App →「打开」)

### 自动更新

- 更新源为本仓库 GitHub Releases;**Windows 全自动**(启动 + 每 4 小时检查,下载后提示重启安装)
- **macOS 半自动**:菜单「帮助 → 检查更新…」给出下载链接(未签名限制,见 [ADR-0005](./docs/adr/0005-electron-desktop-shell.md))

## License

MIT。本项目基于 Excalidraw(MIT)二次开发并保留其源码,原版权与许可声明见 [LICENSE](./LICENSE)。
