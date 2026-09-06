# ExcaliPPT

基于 [Excalidraw](https://github.com/excalidraw/excalidraw) 二次开发的画布演示工具——用白板的自由度,做幻灯片的事。

## 功能特性

在 Excalidraw 完整画图能力之上,面向「画布 → 演示」场景的增强:

- **幻灯片(Slide)**:批量创建预设尺寸(默认 16:9 / 1920×1080)的 Frame 作为幻灯片,右侧导航面板聚焦切换
- **多画布**:单端口多画布(`?canvas=<id>`),主菜单「画布管理」支持新建 / 重命名 / 删除
- **口播提词器**:始终置顶小窗,大字号自动滚屏,与画面互不干扰
- **幻灯片录制**:按幻灯片目标分辨率离屏渲染导出视频,可选摄像头 / 麦克风 / 录制指针
- **激光笔与演示标注**、文字字号滑块等细节增强

## 下载与安装

### 桌面版

从 [Releases](https://github.com/nephilimbin/ExcaliPPT/releases) 下载对应系统的安装包:

| 安装包                             | 适用系统                              |
| ---------------------------------- | ------------------------------------- |
| `ExcaliPPT_<版本>_Windows_x64.exe` | Windows 10 及以上(64 位)              |
| `ExcaliPPT_<版本>_macOS_arm64.dmg` | macOS 12 及以上,Apple Silicon(M 系列) |
| `ExcaliPPT_<版本>_macOS_x64.dmg`   | macOS 12 及以上,Intel 芯片            |

安装步骤与常见问题见 [desktop/INSTALL.md](./desktop/INSTALL.md)。

### 检查更新

- **Windows**:启动时及每 4 小时自动检查并下载更新,也可在主菜单「检查更新…」手动触发
- **macOS**:主菜单「检查更新…」检查新版本并跳转下载(未签名应用不支持全自动更新)

### 网页版(自部署)

```bash
docker compose up --build -d
```

访问 http://localhost:3100,完整部署说明见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 开发

```bash
yarn install
yarn start        # dev server,http://localhost:3001
```

开发规范见 [CLAUDE.md](./CLAUDE.md),领域词汇见 [CONTEXT.md](./CONTEXT.md),架构决策见 [docs/adr/](./docs/adr/)。

## License

MIT。本项目基于 Excalidraw(MIT)二次开发并保留其源码,原版权与许可声明见 [LICENSE](./LICENSE)。
