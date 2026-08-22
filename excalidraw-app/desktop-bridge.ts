// 桌面版(Electron)运行时桥。
// 桌面壳的 preload 向页面注入 window.__excalipptDesktop__(contextBridge);
// web 部署(nginx / dev server)下该全局不存在 → isDesktopApp() 恒 false,所有门禁走 web 默认。
//
// 注意:同一份构建产物同时服务 web 与桌面。凡「桌面要屏蔽 / 分流的 web 行为」
// (SW 注册、AI 入口、提词器宿主选择)都必须经此处的**运行时判断**,
// 不能依赖构建时 env 缺省——web 侧若烘入了配置,桌面用的还是同一份产物。

/** preload 暴露给渲染进程的桌面能力面。保持最小,按需增加。 */
export interface ExcalipptDesktopBridge {
  /** 运行平台("darwin" | "win32" | …)。 */
  readonly platform: string;
  /** 提词器原生置顶窗:由主进程开 alwaysOnTop 子窗(子窗自渲染,不走 portal)。 */
  readonly teleprompter: {
    /** 打开置顶提词窗(主进程携带主窗当前 query,子窗读到同一画布文稿)。失败返回 false。 */
    open(): Promise<boolean>;
    /** 关闭置顶提词窗(幂等)。 */
    close(): void;
    /** 提词窗被关闭(用户点叉 / 主进程清理)时回调;返回取消订阅函数。 */
    onClosed(cb: () => void): () => void;
  };
}

declare global {
  interface Window {
    __excalipptDesktop__?: ExcalipptDesktopBridge;
  }
}

/** 桌面桥(存在即桌面环境);web 下为 null。 */
export const getDesktopBridge = (): ExcalipptDesktopBridge | null =>
  (typeof window !== "undefined" && window.__excalipptDesktop__) || null;

/** 当前是否运行在桌面壳(Electron)里。 */
export const isDesktopApp = (): boolean => getDesktopBridge() !== null;

/** PWA service worker 仅 web 注册:桌面壳的自定义协议下 SW 无意义且可能报错。 */
export const shouldRegisterServiceWorker = (): boolean => !isDesktopApp();

/** AI 入口仅 web 渲染:桌面版定位纯本地创作工具,即使构建烘了后端地址也必须隐藏。 */
export const shouldRenderAIComponents = (): boolean => !isDesktopApp();
