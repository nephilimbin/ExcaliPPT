# 画布管理:扫描即真源的注册表 + 手动删除,不做「关闭即删」

## 背景

多画布(`?canvas=<id>`,见 [CONTEXT.md](../../CONTEXT.md)「Canvas」)下,每个画布往 **3 个存储**写数据,全经 `canvasScopedKey` 分域:

- `excalidraw:<id>`(元素,localStorage)
- `excalidraw-state:<id>`(appState,localStorage)
- `files-db:<id>`(图片 blob,IndexedDB —— `LocalData.ts` 的 `createStore(canvasScopedKey("files-db"), ...)`)

「新建画布」(`AppMainMenu.tsx`)生成随机 id(`generateCanvasId`,8 位 base36)并 `window.open(_blank)` 开新 tab。问题:随机 id 无可记忆 URL、**无画布清单、无列举/删除入口** → 三个存储**永久 orphan**,普通用户无法清理。即两个痛点:画布「丢失」(够不到)+「无法删除」。

## 决策

**画布管理 = 全局注册表 + 扫描即真源 + 主菜单对话框 + 仅手动删除。**

1. **注册表**:全局 localStorage 键 `excalidraw-canvases`,存 `CanvasRecord[] = { id, name, createdAt, updatedAt }`。Default Canvas(id=`"default"`)永在、不可删。
2. **扫描即真源**:打开管理对话框(或 init)时枚举 localStorage 的 `excalidraw:*` / `excalidraw-state:*` 键,抽出 id 与注册表对账——补登新画布、剔除已删。注册表持久部分**仅存名称**;`updatedAt` 随各画布自己的 appState 自动保存更新,扫描时读取。这样注册表**自愈、不漂移**,无需脆弱的生命周期 hook 维持一致性,且**老 orphan 画布自动浮现**(直接解决「丢失」)。
3. **管理 UI**:主菜单新增「画布管理…」,弹对话框列画布(名称 + 相对时间 + 当前高亮),行内 **打开 / 重命名 / 删除**。「打开」跳 `?canvas=<id>`。
4. **命名**:无现成工具;`createdAt` 时间戳自动名(如「画布 08-11 14:30」)+ 可重命名。
5. **删除**:二次确认;清 `excalidraw:<id>` + `excalidraw-state:<id>` + IndexedDB `files-db:<id>` + 注册表项;删当前画布跳回 default。

## 备选方案(已否决)

- **「关闭即删」(非根画布 tab 关闭即清)**:零堆积,但**颠倒 Excalidraw「每次改动自动落盘」的核心承诺**——误关 tab / 浏览器崩溃即无声丢稿;`beforeunload` 在崩溃时不触发,多 tab 同开需 refcount(本仓已有 `tabSync.ts`)。用一个「无声数据丢失」换「无声存储泄漏」,两者皆坏。**否决。**
- **sessionStorage 托管非根画布**:tab 关即丢(同上风险),且 IndexedDB 无 sessionStorage 对应物 → 双后端复杂。否决。
- **LRU 自动淘汰**:有界,但被挤掉时「我的画布怎么没了」仍是无声丢失;留作 v2 增量,不进 v1。
- **生命周期 hook 维持注册表**:每次创建/保存/删除手动写注册表,易与实际存储漂移。扫描即真源更稳,否决 hook-only。

## 后果

- 两个痛点直接解决:orphan 画布在对话框**浮现**(可打开)、**可删除**(清三存储)。
- **不引入数据丢失风险**:无自动删除,删必经用户二次确认。
- Default Canvas 是用户的稳定「主」画布;Scratch Canvas 可被管理。
- 已知边界:多 tab 一致性——在 default tab 删除某画布时,若该画布在另一 tab 仍开着,可能在下次改动 re-save「复活」。v1 接受「复活即重新浮现」(扫描自愈,非数据损坏);后续可借 `tabSync.ts` 广播关闭。
- 不改 `Slide ≡ Frame`([ADR-0001](./0001-slide-equals-frame.md))、不动提词器([ADR-0002](./0002-teleprompter-separate-window.md));画布管理是旁路,与 scene / 元素类型正交。

## 补充决策:空画布不留痕(2026-08-12)

**保存时若画布内容为空,移除该画布全部 localStorage 键(elements / state / meta),不进列表。** 落在 `LocalData.saveDataStateToLocalStorage`:`getNonDeletedElements(elements).length === 0` → `removeItem` 三键;非空才写。default 例外——`scanCanvasIds` 强制包含 default,即使空也始终可见。

### 动机

1. 用户反馈:批量点「新建画布」却几乎都扫不到。
2. **根因(实现期发现)**:`LocalData.isSavePaused()`(`LocalData.ts`)在 `document.hidden === true` 时返回 true,失焦 tab 的**首次 onChange save 被完全跳过且永不重试**——`excalidraw-app/App.tsx` 的 visibility handler 在 tab 变可见时只读不写(从 localStorage 读到 app,不把场景写回),onChange 也不会因 hidden→visible 重新触发。连点多个新建时,浏览器只 focus 最后一个 tab,前面 tab 失焦 → 初始化完成时 save 被挡 → 永不写键 → 扫不到。
3. **关键观察**:失焦 tab 用户看不见、无法绘制,内容**必然为空**。「空不留痕」正好把这些失焦空画布排除,无需动 `isSavePaused` 核心逻辑,顺带根治失焦丢失。

### 后果

- 连点 N 个新建、都不画 → 列表一个都不增(失焦的因 `isSavePaused` 不存;focus 的首次空场景被「空不写」挡掉)。
- 画了内容 → 保留;清空(全选删 / ClearCanvas)→ 列表隐藏(URL 仍可访问,重新画内容自动重现,画布不丢)。
- default 画布即使空也永在列表(不可删,主画布)。
- 这是对原决策 5「仅手动删除」的补充:空画布在 save 时自动不留,不再纯靠手动删;非空画布仍只能手动删(无自动淘汰)。
