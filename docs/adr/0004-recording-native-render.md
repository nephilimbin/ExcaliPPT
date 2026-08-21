# 录制:离屏原生分辨率渲染(A),而非屏幕区域采样(B);用合成录制指针替代激光笔

## 背景

幻灯片要加 Recording（见 [CONTEXT.md](../../CONTEXT.md)「Recording」）：实时把「当前聚焦 slide」录成视频，含可选摄像头 / 麦克风 / 演示指针。采集源有两条路：

- **A. 离屏原生分辨率渲染**：每帧用 `exportToCanvas({ exportingFrame })`（`packages/utils/src/export.ts`）把当前 frame 按目标分辨率离屏重绘，合成摄像头 / 指针后 `captureStream()` → `MediaRecorder`。
- **B. 屏幕区域采样**：`captureStream` 主 Excalidraw `<canvas>`，裁剪 frame 在屏幕上的像素区域。

硬约束：录制分辨率 = slide 目标分辨率（「完全重叠」）、随 slide 切换跟随。另：激光笔工具是 **SVG overlay**（`LaserTrails` / `PresentationTrails` → `AnimatedTrail` 用 `createElementNS(SVG_NS,"path")` + `<animate>` 画轨迹，挂在一个 `<svg>` 容器里，浮在 static / interactive 两层 canvas 之上、**不进 `scene.elements`**）。

## 决策

**采 A。** 唯一满足「分辨率 = 目标分辨率」的路径；自动排除 UI 工具栏 / 面板与 PiP 提词器（独立 browsing context，从不出现在 canvas 派生画面里）；输出广播级画质。录制区域按「当前聚焦 slide 的身份（id）」跟踪——每帧重渲染其 frame 内容，与其在无限画布的坐标无关。

**激光笔录不到 → 用合成「录制指针」替代**：红色光晕圆点，跟随编辑器鼠标，经视口逆变换（反推 `SlidesPanel.tsx:253` 的 `screenX = (canvasX + scrollX) * zoom + offsetLeft`）映射到当前 slide 坐标；仅在指针落入 slide 边界内绘制；录制设置开关。录制指针 **≢ 激光笔工具**（后者是 SVG overlay、不进 `scene.elements`，A 的 `exportToCanvas` 与 B 的 `captureStream` 都录不到——只有 DOM/屏幕级抓取能拿到）。

## 备选方案（已否决）

- **B. 画布区域采样（`captureStream` 主 `<canvas>`）**：分辨率 = 屏幕像素 × zoom（zoom < 1 时低于目标分辨率），违背「完全重叠」；含 UI 工具栏需额外裁剪。**且同样录不到激光笔**——激光笔是 SVG overlay、不在 canvas 上。即 B 相对 A **无任何优点**，否决。
- **getDisplayMedia 整屏 / 显示器抓取**：**唯一能录到 SVG 激光笔**的路径（整页像素级合成含 SVG overlay），但会把 PiP 提词器窗口录进画面、违背「提词器不录」，走屏幕分辨率而非目标分辨率，且需用户在权限弹窗里选源、体验差。否决。
- **录真实激光笔而非合成指针**：激光笔是 SVG overlay、不进 `scene.elements`，A 的 `exportToCanvas` 拿不到；要拿就得改渲染管线把激光笔轨迹纳入场景元素或额外合成 SVG，代价过大。改用合成指针等价满足「演示指点的视觉需求」。

## 后果

- 成片 = slide 内容（目标分辨率）+ 可选摄像头 + 可选合成指针 + 麦克风；干净、无 UI / PiP 污染。
- 已知代价：实时绘制中的笔迹在 `pointerup` 提交进场景前不在 scene elements，成片中「边画边出现」的笔迹可能延迟约一帧（可接受）。
- 仅 Chrome / Edge 完整支持（`MediaRecorder` + `getUserMedia` + `captureStream`）；Safari / Firefox 降级或禁用，参照 `supportsDocumentPiP` 的按钮门禁模式。
- 与 `Slide ≡ Frame`（[ADR-0001](./0001-slide-equals-frame.md)）、提词器（[ADR-0002](./0002-teleprompter-separate-window.md)）、画布管理（[ADR-0003](./0003-canvas-management.md)）均正交：不改元素类型 / AppState / scene，旁路工具。
