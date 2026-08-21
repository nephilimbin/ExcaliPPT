# 幻灯片工具 (Slide Tool)

为 Excalidraw 增加「批量创建预设尺寸的 Frame + 右侧导航面板」的功能，用于演示 / 短视频分镜场景。**Frame 内容尺寸 = 目标分辨率**（所见即所得）。出厂默认预设 **16:9 (1920×1080)**。

## Language

**Slide（幻灯片）**：一个用于演示或分镜、被命名的 Frame 元素。用户视角的领域词。 _Avoid_: 画框（歧义）、page、screen、面板

**Frame（画框）**： Excalidraw 既有的元素类型（`type: "frame"`），是 Slide 的唯一实现载体。**Slide ≡ Frame**（见 [ADR-0001](./docs/adr/0001-slide-equals-frame.md)）。 _Avoid_: 容器、分组框

**Aspect Preset（比例预设）**：预定义的长宽比 + 目标分辨率组合（如 16:9 / 1920×1080），用于批量创建 Slide。换算**锁定联动**（改一端，另一端按比例跟）。 _Avoid_: 尺寸模板、比例模板

**Canvas（画布）**：通过 URL `?canvas=<id>` 标识的独立 Excalidraw 文档；数据存浏览器 localStorage / IndexedDB，**容器不持久化**，换浏览器/清缓存即丢。`default` 为缺省画布。 _Avoid_: 文件、文档、工作区

**Default Slide Config（默认幻灯片配置）**：跨**所有画布**共享的用户偏好（默认预设 + 自定义预设），存**全局 localStorage 键**（非 canvas-scoped）。点「保存为默认」即更新，新画布继承。 _Avoid_: 画布配置

**Canvas Slide Config（画布幻灯片配置）**：单个 Canvas 内的配置，**覆盖** Default。新画布初始化 = Default；在该画布内改配置（不「保存为默认」）则写此处。 _Avoid_: 默认配置

**Teleprompter（口播提词器）**：Document Picture-in-Picture 始终置顶小窗形态（仅 Chrome/Edge 116+）的提词器，大字号自动滚屏的口播文稿；由 SlidesPanel 按钮触发。与 Slide 数据**正交**——不进场景 / frame / 导出，仅存 localStorage。切 slide 的画布动画（focusFrame）波及不到它（独立 browsing context）。 _Avoid_: 字幕板（歧义，易与「画面字幕」混）、备注栏、caption。

**Recording（录制）**：把「当前 slide」按其目标分辨率实时合成（slide 内容 + 可选摄像头 / 麦克风 / 录制指针）编码成视频文件的旁路功能。采集源 = **离屏原生分辨率渲染**（每帧 exportToCanvas 重绘当前 frame，非屏幕采样），见 [ADR-0004](./docs/adr/0004-recording-native-render.md)。与 Slide 数据**正交**——不进场景 / frame / 导出，设置存 localStorage。 _Avoid_: 录屏（歧义，易混 getDisplayMedia 整屏抓取——本功能**禁止**整屏抓取，会把 PiP 提词器录进去）、capture。

**Recording Pointer（录制指针）**：录制时合成进成片的红色光晕圆点，跟随编辑器鼠标、经视口逆变换映射到当前 slide 坐标；**仅在指针落入 slide 边界内**绘制；由录制设置开关控制。**≢ 激光笔工具**——激光笔是 SVG overlay（`AnimatedTrail` 画的 `<svg><path>`，浮在两层 canvas 之上、不进 `scene.elements`），任何 canvas 派生画面（A 的 `exportToCanvas` 与 B 的 `captureStream`）都录不到它；录制指针是成片内的假指针，二者正交。 _Avoid_: 光标（歧义）、激光笔（特指那个工具）。

**Default Canvas（默认画布）**：根路径 `/` 的固定画布（id=`"default"`），用户的「主」画布；**唯一不可删除**，习惯与设置在此稳定累积。 _Avoid_: 主画布、home。

**Scratch Canvas（临时画布）**：经「新建画布」（随机 id）生成、默认开新 tab 的画布；可被列举 / 重命名 / 删除。 _Avoid_: 子画布、sub-canvas。

**Canvas Registry（画布注册表）**：全局画布清单（id + 名称 + 时间戳）。真源 = 扫描 localStorage 键（`excalidraw:<id>` / `excalidraw-state:<id>`），自愈、不漂移；持久部分仅存名称。 _Avoid_: 画布索引、canvas list（实现细节）。

**Orphan Canvas（孤儿画布）**：存在于 localStorage 但用户够不到（随机 id 无 URL 即失联）的画布；注册表扫描可恢复可见。 _Avoid_: 遗留画布。

## Relationships

- 一个 **Slide** ≡ 一个 **Frame** —— 不引入新元素类型
- **Aspect Preset** 决定 **Slide** 的比例 + 目标分辨率；**Frame 内容尺寸 = 该分辨率数值**
- 右侧导航列表枚举画布上**所有 Frame**；点击 → 缩放聚焦 + 顶部对齐（所有 Slide 仍在画布）
- 一次创建 N 张 **Slide** = 创建 N 个预设尺寸 Frame：视口中心起、按方向（横屏垂直 / 竖屏横向）固定间距排开，创建后聚焦第一张
- 配置两层：**Default Slide Config**（全局）← 被 **Canvas Slide Config**（画布级）覆盖；新画布继承 Default
- Frame 内容尺寸 ≠ 屏幕尺寸：**屏幕显示 = Frame 尺寸 × zoom**（zoom 只适配屏幕，不改内容）
- **Teleprompter** 与 **Slide** 正交：旁路工具，不引入 slide 元数据、不动 `Slide ≡ Frame`；由 SlidesPanel 按钮触发独立窗口，画布动画波及不到
- **Recording** 与 **Slide** 正交：旁路工具，不改 `Slide ≡ Frame`、不进 scene；录制区域 = 当前聚焦 slide 的 frame 内容（目标分辨率），随 slide 切换而切换。**提词器**（独立 PiP browsing context）与 **Recording** 互不影响——只要采集源是 canvas 派生，PiP 永不出现在画面里
- **画布管理**：主菜单「画布管理…」对话框列举所有 Canvas（Default + Scratch），支持 打开 / 重命名 / 删除；删除清 `excalidraw:<id>` + `excalidraw-state:<id>` + IndexedDB `files-db:<id>` + 注册表项。**无自动淘汰**（v1 仅手动删），**不做「关闭即删」**（数据丢失风险——见 [ADR-0003](./docs/adr/0003-canvas-management.md)）

## Example dialogue

> **Dev:**「我在画布上随便画的 Frame，会进幻灯片列表吗？」 **PM:**「会——Slide 就是 Frame，列表枚举所有 Frame。」
>
> **Dev:**「我屏幕 1500×940，创建 1920×1080 的幻灯片放不下？」 **PM:**「放得下。1920×1080 是 frame 内容尺寸，zoom 缩到 0.7 就显示 1344×756 进屏幕。zoom 适配屏幕，不动内容。」
>
> **Dev:**「画布 A 存的默认比例，画布 B 能用吗？」 **PM:**「Default Slide Config 是全局的，新画布都继承；但 B 也能改自己的 Canvas Slide Config 覆盖它。」

## Flagged ambiguities（已解决）

- 「画框」「frame」「幻灯片」混用 → resolved：**Slide** 领域词，**Frame** 实现载体，同一对象；UI 用「幻灯片」。
- 默认比例口径（文字 9:16 / 示例文件 3:4）→ resolved：由 Default Slide Config 决定；**出厂默认 16:9**。
- 「跨画布继承」是否需画布级覆盖 → resolved：需要，两层（Default + Canvas）。
- Frame 尺寸用分辨率还是编辑尺寸 → resolved：**目标分辨率（甲）**，所见即所得。
- 「屏幕放不下大分辨率」→ resolved：混淆了内容尺寸（②）与屏幕像素（①），zoom 桥接二者。
- 「口播字幕板」是画内字幕还是画外提词器 → resolved：**画外·独立窗口提词器**（方案 A），不进 frame；逐页口播（方案 B）v1 不做，升级仅需改存储为按 frame id 多键。

## Flagged ambiguities（未决）

- **导出范围**：原止于「创建 + 编辑 + 导航」；frame → 视频**已纳入范围**（Recording 功能，见 [ADR-0004](./docs/adr/0004-recording-native-render.md)），采集源为离屏原生分辨率渲染。
- **协作（collab）配置共享**：配置存本地 localStorage，协作者看不到你的预设 / 默认配置 → 是否需要同步待定。
