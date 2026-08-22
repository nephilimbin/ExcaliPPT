// 门禁意图:桌面壳中运行的同一份产物必须「不注册 SW、不渲染 AI 入口」,
// 而 web 部署(同一份产物、无注入)两项行为保持原样。
// 若有人把门禁改成构建时常量(如 env 判断),这里的用例会在桌面/web 混布场景下失去保护,应跟着改写。

import {
  getDesktopBridge,
  isDesktopApp,
  shouldRegisterServiceWorker,
  shouldRenderAIComponents,
  type ExcalipptDesktopBridge,
} from "./desktop-bridge";

const fakeBridge: ExcalipptDesktopBridge = {
  platform: "darwin",
  teleprompter: {
    open: () => Promise.resolve(true),
    close: () => {},
    onClosed: () => () => {},
  },
};

describe("desktop bridge gating", () => {
  afterEach(() => {
    delete window.__excalipptDesktop__;
  });

  it("web 部署:无注入 → 非桌面,SW 注册与 AI 入口均放行", () => {
    expect(getDesktopBridge()).toBe(null);
    expect(isDesktopApp()).toBe(false);
    expect(shouldRegisterServiceWorker()).toBe(true);
    expect(shouldRenderAIComponents()).toBe(true);
  });

  it("桌面壳:注入桥 → 桌面环境,SW 与 AI 均被门禁", () => {
    window.__excalipptDesktop__ = fakeBridge;
    expect(getDesktopBridge()).toBe(fakeBridge);
    expect(isDesktopApp()).toBe(true);
    expect(shouldRegisterServiceWorker()).toBe(false);
    expect(shouldRenderAIComponents()).toBe(false);
  });
});
