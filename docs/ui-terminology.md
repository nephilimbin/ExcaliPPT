# Excalidraw UI 模块术语对齐

> 沟通界面时,各模块的统一中文叫法与代码命名映射。用于指代一致、快速定位代码。

## 术语表

| 中文叫法 | 代码命名 | 文件位置 | 说明 |
| --- | --- | --- | --- |
| 主菜单 | `MainMenu`(默认实例 `DefaultMainMenu`) | `components/main-menu/MainMenu.tsx` | 左上角展开的功能菜单 |
| 顶部工具栏 | `Toolbar` | `components/Toolbar.tsx` | 选择 / 矩形 / 箭头 / 文字等绘图工具 |
| 属性面板 | `SelectedShapeActions` / `CompactShapeActions` | `components/Actions.tsx` | 描边色 / 背景色 / 线宽 / 样式 / 透明度等;由 `LayerUI.renderSelectedShapeActions` 渲染 |
| 侧栏(右侧面板) | `Sidebar`(默认实例 `DefaultSidebar`) | `components/Sidebar/Sidebar.tsx`、`components/DefaultSidebar.tsx` | 右上角按钮展开的面板 |
| 画布悬浮按钮 | `ElementCanvasButtons`(单按钮 `ElementCanvasButton`) | `components/ElementCanvasButtons.tsx` | 浮在单个选中元素右上角的快捷操作 |

## 易踩坑

- **主菜单、顶部工具栏、属性面板三者共用左上角的 `FixedSideContainer side="top"`**。容器虽叫 "top",但视觉靠左上竖排。「点击工具后左边弹出的」指的是**属性面板**。
- **属性面板的 i18n key 是 `selectedShapeActions`**。
- **画布悬浮按钮 ≠ 普通元素操作条**。它仅在选中**单个特定元素**时出现:
  - AI 魔法框(`isMagicFrameElement`)→「转为代码」
  - iframe(生成完成 `generationData.status === "done"`)→「复制源码」+「全屏」
  - 显隐条件:右键菜单 / 绘制中 / 缩放 / 旋转 / 打开菜单 / 只读模式 时不显示。
- **普通图形(矩形 / 箭头 / 文字)的删除 / 层级 / 成组操作在右键菜单(`ContextMenu`)**,不在悬浮按钮。

## 相关

- 元素层决策见 `docs/adr/0001-slide-equals-frame.md`(Slide ≡ Frame)
- i18n 机制见 `.claude/rules/typescript/i18n.md`
