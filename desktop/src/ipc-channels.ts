// IPC 通道契约:主进程(main.ts)与 preload 共用的通道名真源。
// 渲染进程只接触 preload 暴露的桥(excalidraw-app/desktop-bridge.ts),不直接使用这些通道名。
export const IPC = {
  /** 渲染 → 主:invoke,打开提词器置顶子窗(主进程自带主窗 query)。 */
  teleprompterOpen: "excalippt:teleprompter:open",
  /** 渲染 → 主:send,关闭提词器子窗(幂等)。 */
  teleprompterClose: "excalippt:teleprompter:close",
  /** 主 → 渲染:提词器子窗已关闭(用户点叉 / 主进程清理)。 */
  teleprompterClosed: "excalippt:teleprompter:closed",
  /** 渲染 → 主:send,手动触发检查更新(Win 自动下载安装;mac 弹下载链接)。 */
  checkForUpdates: "excalippt:updates:check",
  /** 主 → 渲染:更新流程状态推送(检查/发现新版/下载进度/下载完成/出错)。 */
  updateStatus: "excalippt:updates:status",
  /** 渲染 → 主:send,重启并安装已下载的更新(主进程防重复守卫)。 */
  installUpdate: "excalippt:updates:install",
  /** 渲染 → 主:invoke,拉取最近一条更新状态(晚挂载窗口补偿纯推送漏掉的终态)。 */
  getUpdateStatus: "excalippt:updates:get",
} as const;

/**
 * 更新流程状态载荷(main.ts 与 preload.ts 共用本定义;
 * excalidraw-app/desktop-bridge.ts 因构建边界保留同形副本,两侧同源维护)。
 * checking / not-available / error 仅手动检查路径广播;
 * available / downloading / downloaded 手动与后台周期检查都广播(下载对用户必须可见)。
 */
export type UpdateStatus =
  | { type: "checking" }
  | { type: "available"; version: string }
  | {
      type: "downloading";
      version: string;
      percent: number;
      transferred: number;
      total: number;
      bytesPerSecond: number;
    }
  | { type: "downloaded"; version: string }
  | { type: "not-available"; currentVersion: string }
  | { type: "error"; message: string };
