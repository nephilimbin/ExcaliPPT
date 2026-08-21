# 提词器用独立 browsing context(画中画小窗),而非画布内浮层

## 背景

幻灯片功能要加一个口播提词器(自动滚屏的大字号文稿),供短视频/直播口播时朗读。硬性需求:**切 slide 时提词器不受影响**。而当前切 slide 的 `focusFrame` 会对画布做缩放 + 滚动动画——任何画布内浮层(即使 `position: fixed`)都会被这场动画波及,且与画布争抢屏幕空间。

## 决策

**提词器 = Document Picture-in-Picture 画中画小窗**(仅 Chrome/Edge 116+;其余浏览器按钮禁用)。点 SlidesPanel 的"提词器"按钮 `requestWindow` 开一个始终置顶的小窗,经 `createPortal` 把 `<Teleprompter/>` 挂到其 `document.body`。它是独立 browsing context,与画布动画物理隔离,"切 slide 不受影响"由架构免费满足;且 PiP **可跨应用始终置顶**,正好满足直播口播需求。

文稿/进度按画布隔离存 localStorage(见 teleprompter-storage),PiP 关闭重开即恢复。

## 演进(原 window.open 标签页方案已移除)

v1 用 `window.open(?teleprompter=1)` 开独立标签页窗口。后追加"置顶"按钮转 Document PiP,二者并存。但**标签页 ↔ PiP 切换**踩中浏览器安全限制:

- PiP 内点击的 user activation **不跨 document** 传给主窗口;主窗口的 `window.open` / `window.focus` 在 activation 过期后失效 → "返回标签页"无法恢复标签页;
- 跨窗口前置(`window.focus`)本身不可靠(浏览器防骚扰策略)。

而标签页与 PiP 除地址栏外无差异。故移除标签页窗口机制(`teleprompter-window.ts`、`?teleprompter=1` 路由),统一为单一 PiP 小窗,"提词器"按钮直接开/关它。PiP 仍是独立 browsing context,核心约束不变。

## 备选方案(已否决)

- **画布内浮层 / 面板内嵌**:原以"`focusFrame` 的画布缩放/滚动会波及 fixed 浮层(MEDIUM-5:`.excalidraw` 的 scrollLeft 让 fixed 漂移)"为由否决。**[2026-08 勘误]** 经 spike 复核,该论断不成立:`focusFrame` 改的是 AppState.scrollX/scrollY/zoom,经 Canvas 2D context.translate/scale 渲染,不动任何 DOM;`.excalidraw` 及祖先都无 transform/filter/will-change 等 containing-block 属性,故 `position: fixed` 浮层对切 slide 天然免疫(先例 `PresentationTextInput` 即挂 `.excalidraw` 内、fixed、不漂)。画布内方案技术上可行,已作为可选形态重新引入,见文末"演进"。
- **window.open 独立标签页窗口**:见上"演进",因 activation/focus 不可靠 + 与 PiP 功能重复而移除。

## 后果

- Document PiP **可跨应用始终置顶**(优于原 window.open 标签页,后者无法置顶)——解决直播口播的核心痛点。
- 仅 Chrome/Edge 116+ 支持;Safari/Firefox 无 PiP,"提词器"按钮禁用。
- PiP 内 DOM 受浏览器隔离,不在 Playwright tab 体系;e2e 只验开/关集成,内部功能靠单测(teleprompter-engine / teleprompter-storage)。
- 提词器与 `Slide ≡ Frame` 模型正交:不改元素类型、AppState、scene(符合 [ADR-0001](./0001-slide-equals-frame.md))。

## 演进:画布内可选形态(2026-08)

PiP 形态保留(直播跨应用置顶不可替代),同时新增**画布内形态**作为可选,二者由设置面板录制分栏切换(`TeleprompterSettings.displayMode`)。动机:不依赖 Document PiP(Safari/Firefox 也能用)、不想开独立窗口时在主窗口内半透明叠加念稿。

- 画布内形态 = **可拖动/可缩放的浮动小窗**(默认 480×320,工具栏空白处按住拖动、右下角手柄缩放,位置/大小持久化 `inlineX/Y/W/H`),`createPortal` 到主文档 `document.body`,背景不透明度可调(`bgTransparency`,0–100 越大越透)。只挡浮窗自身区域,画布其余部分照常操作。初版曾做全屏覆盖,因盖死画布无法操作而废弃。
- 浮窗需 `z-index: 10000` 压过 Excalidraw 全部 UI(其体系最高 modal=1000/popup=1001);无 z-index 时会被 canvas 盖住——DOM 在但视觉不可见(e2e 教训:可见性必须用 elementFromPoint 命中测试验证,DOM 存在性不算数)。
- 「切 slide 不受影响」仍成立(见上勘误:fixed 浮层对 focusFrame 免疫),不再依赖独立 browsing context。
- 代价:画布内形态**不跨应用置顶**(仅在 Excalidraw 窗口内可见);PiP 形态仍保留跨应用置顶。
- 透明度实时同步走 props(SlidesPanel 持 state → `<Teleprompter bgOpacity/>`),跨 portal(含跨 document 的 PiP)正常传递。
