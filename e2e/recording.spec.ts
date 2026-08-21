import { expect, test, type Page } from "@playwright/test";

// 端到端:录制 UI 集成。真实 MediaRecorder/getUserMedia/下载在测试浏览器里不稳定,
// 参照提词器套路(ADR-0002):e2e 只验 UI 集成行为(分栏切换、形状切换、按钮门禁、REC 指示);
// 引擎/配置/坐标映射/设备逻辑由 recording/*.test.ts 单测覆盖。

const openSettings = async (page: Page) =>
  page
    .locator(".slides-dock__top")
    .getByRole("button", { name: /设置|Settings/ })
    .click();

const openRecordingTab = async (page: Page) => {
  await openSettings(page);
  await page.locator(".slides-dock__settings-tabs button:nth-child(2)").click();
};

test.describe("录制设置与控件", () => {
  test("设置分栏 幻灯片↔录制 切换字段", async ({ page }) => {
    await page.goto("/?canvas=e2e-rec1");
    await expect(page.locator(".excalidraw")).toBeVisible();
    await openSettings(page);
    // 默认幻灯片 tab:比例字段可见
    await expect(page.locator(".slides-dock__settings")).toContainText(
      /比例|Aspect/,
    );
    // 切到录制 tab:摄像头字段可见、比例字段消失
    await page
      .locator(".slides-dock__settings-tabs button:nth-child(2)")
      .click();
    await expect(page.locator(".slides-dock__settings")).toContainText(
      /摄像头|Camera/,
    );
    await expect(page.locator(".slides-dock__settings")).not.toContainText(
      /比例|Aspect/,
    );
  });

  test("摄像头形状 圆/方 分段切换 is-active", async ({ page }) => {
    await page.goto("/?canvas=e2e-rec2");
    await expect(page.locator(".excalidraw")).toBeVisible();
    await openRecordingTab(page);
    // 形状 segmented = 设置内除 tab 栏之外的 segmented
    const shapeBtns = page.locator(
      ".slides-dock__settings .slides-dock__segmented:not(.slides-dock__settings-tabs) button",
    );
    // 默认第 1 个(圆形)active
    await expect(shapeBtns.first()).toHaveClass(/is-active/);
    // 点第 2 个(方形)→ 方形 active,圆形失活
    await shapeBtns.nth(1).click();
    await expect(shapeBtns.nth(1)).toHaveClass(/is-active/);
    await expect(shapeBtns.first()).not.toHaveClass(/is-active/);
  });

  test("录制按钮门禁 + REC 指示开合", async ({ page }) => {
    await page.goto("/?canvas=e2e-rec3");
    await expect(page.locator(".excalidraw")).toBeVisible();
    const supports = await page.evaluate(
      () =>
        typeof MediaRecorder !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia,
    );
    test.skip(!supports, "浏览器不支持 MediaRecorder/getUserMedia");

    // 建一张 slide 聚焦(否则无聚焦 frame,录制点不动)
    await page
      .locator(".slides-dock__top")
      .getByRole("button", { name: /添加幻灯片|Add slide/ })
      .click();

    const recBtn = page
      .locator(".slides-dock__top")
      .getByRole("button", { name: /^录制$|^Record$/ })
      .first();
    await expect(recBtn).toBeVisible();

    // 容忍下载(测试浏览器里真实编码/下载不稳,不强制断言)
    const dl = page
      .waitForEvent("download", { timeout: 15000 })
      .catch(() => null);

    await recBtn.click();
    // REC 胶囊(停止录制)出现
    await expect(page.locator(".slides-dock__rec")).toBeVisible();

    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /停止录制|Stop recording/ }).click();
    // 停止后 REC 胶囊消失
    await expect(page.locator(".slides-dock__rec")).toBeHidden();
    await dl;
  });
});
