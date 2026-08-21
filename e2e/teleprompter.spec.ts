import { expect, test, type Page } from "@playwright/test";

// 端到端:提词器画中画(Document Picture-in-Picture)小窗。
// 点"提词器"按钮开/关始终置顶的小窗(仅 Chrome/Edge 116+ 支持;其余浏览器按钮禁用)。
// Teleprompter 内部功能(播放滚屏 / 字号 / 镜像 / 进度恢复)是纯组件逻辑,由单元测试
// 覆盖(teleprompter-engine.test.ts、teleprompter-storage.test.ts);PiP 内 DOM 受
// 浏览器隔离、不在 Playwright 的 tab 体系内,e2e 只验证开/关集成行为与按钮高亮。

const prompterButton = (page: Page) =>
  page
    .locator(".slides-dock__top")
    .getByRole("button", { name: /提词器|Teleprompter/ });

test.describe("teleprompter 画中画小窗", () => {
  test("点提示词按钮开/关小窗,按钮高亮反映开合", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".excalidraw")).toBeVisible();

    const supports = await page.evaluate(
      () =>
        !!(window as unknown as { documentPictureInPicture?: unknown })
          .documentPictureInPicture,
    );
    test.skip(!supports, "浏览器不支持 Document Picture-in-Picture");

    const btn = prompterButton(page);

    // 开 → 按钮高亮(PiP 窗口已创建)
    await btn.click();
    await expect(btn).toHaveClass(/slides-dock__btn--active/);

    // 关 → 取消高亮
    await btn.click();
    await expect(btn).not.toHaveClass(/slides-dock__btn--active/);
  });
});
