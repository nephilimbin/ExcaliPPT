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

## License

MIT。本项目基于 Excalidraw(MIT)二次开发并保留其源码,原版权与许可声明见 [LICENSE](./LICENSE)。
