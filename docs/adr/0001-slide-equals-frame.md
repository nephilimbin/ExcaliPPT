# Slide 等价于 Frame，不引入新元素类型

## 背景

幻灯片功能需要一个承载「单页内容 + 命名 + 可导航 + 可演示」的对象。Excalidraw 已有 `type: "frame"` 元素满足全部需求（支持 `name`、可归属子元素、可全屏演示、可导出）。

## 决策

**Slide ≡ Frame**：幻灯片列表直接枚举画布上的 frame 元素，不新建元素类型，也不引入独立的 slide 数据层。点击导航 = 跳转聚焦到该 frame。

## 备选方案（已否决）

- **Slide ⊃ Frame（独立 slide 数据层）**：承载顺序 / 比例预设 / 命名等元数据，frame 只画内容。职责更清晰、能区分幻灯片与其他用途 frame，但要改 appState 或新建 store，复杂度最高。在本项目「frame 专用于幻灯片」的前提下，收益不抵成本，否决。

## 后果

- 画布上**所有** frame 都会被当作幻灯片进入列表——无法区分「幻灯片用 frame」与「分组 / 裁切用 frame」。本项目场景下可接受。
- 未来若需区分用途，应引入「slide 标记」字段（如 `frame.metadata.isSlide`）而非新元素类型，保持本决策的元素层不变。
- 配置（比例预设 / 默认）独立于 frame 存于 localStorage，见 `CONTEXT.md`。
