// IPC 通道契约:主进程(main.ts)与 preload 共用的通道名真源。
// 渲染进程只接触 preload 暴露的桥(excalidraw-app/desktop-bridge.ts),不直接使用这些通道名。
export const IPC = {
  /** 渲染 → 主:invoke,打开提词器置顶子窗(主进程自带主窗 query)。 */
  teleprompterOpen: "excalippt:teleprompter:open",
  /** 渲染 → 主:send,关闭提词器子窗(幂等)。 */
  teleprompterClose: "excalippt:teleprompter:close",
  /** 主 → 渲染:提词器子窗已关闭(用户点叉 / 主进程清理)。 */
  teleprompterClosed: "excalippt:teleprompter:closed",
} as const;
