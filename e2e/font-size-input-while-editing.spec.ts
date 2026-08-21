import { expect, test, type Page } from "@playwright/test";

// Regression for: while editing text inside a shape, clicking the font-size
// number input in the properties panel used to DISMISS the panel (and silently
// commit the text edit).
//
// Root cause (default "full" panel mode): textWysiwyg's window pointerdown
// guard only suspended the textarea's blur-submit for NON-writable targets
// (`target.closest(SHAPE_ACTIONS_MENU) && !isWritableElement(target)`). The
// number input is a writable element, so the guard did not fire; focusing it
// blurred the textarea → handleSubmit → text committed → editingTextElement
// cleared → properties panel unmounted. Fix: drop the `!isWritableElement`
// exclusion so any interaction inside the panel suspends blur-submit.
//
// These tests encode the user-facing invariant, not the implementation: while
// editing text, interacting with the font-size control must keep both the text
// editor and the properties panel alive.

/** Draw a rectangle, double-click to enter bound-text editing, type, select-all. */
async function drawRectangleAndEditText(page: Page) {
  await page.goto("/");
  await expect(page.locator(".excalidraw")).toBeVisible();
  await page.getByTestId("toolbar-rectangle").click();
  const canvas = page.locator("canvas.excalidraw__canvas.interactive");
  const box = (await canvas.boundingBox())!;
  const x = box.x + 360;
  const yTop = box.y + 200;
  // Draw a rectangle.
  await page.mouse.move(x, yTop);
  await page.mouse.down();
  await page.mouse.move(x + 220, yTop + 160, { steps: 12 });
  await page.mouse.up();
  // Double-click the rectangle centre to enter bound-text editing.
  await page.mouse.dblclick(x + 110, yTop + 80);
  const editor = page.locator(".excalidraw-wysiwyg");
  await expect(editor).toBeVisible();
  await page.keyboard.type("Hello bug");
  await page.keyboard.press("Meta+a");
  return editor;
}

test.describe("font-size control while editing text (full panel mode)", () => {
  test("clicking the font-size number input keeps the editor and panel open", async ({
    page,
  }) => {
    await drawRectangleAndEditText(page);
    const input = page.getByTestId("fontSize-number-input");
    await expect(input).toBeVisible();

    await input.click();

    // The regression: both the text editor and the panel (which hosts the
    // input) must survive the click — previously both vanished.
    await expect(page.locator(".excalidraw-wysiwyg")).toBeVisible();
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("typing a new size into the input applies without closing the panel", async ({
    page,
  }) => {
    await drawRectangleAndEditText(page);
    const input = page.getByTestId("fontSize-number-input");
    await expect(input).toBeVisible();
    const before = Number(await input.inputValue());

    await input.click();
    await input.fill("36");
    await input.press("Enter");

    // Editor + panel survive the commit, and the value is applied.
    await expect(page.locator(".excalidraw-wysiwyg")).toBeVisible();
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("36");
    expect(Number(await input.inputValue())).not.toBe(before);
  });
});
