import { expect, test, type Page } from "@playwright/test";

// Characterization tests for the presentation text-annotation editor (laser
// tool → "text" kind). They run against the CURRENT code and must stay green
// through the editing-state convergence refactor — guarding the immutable
// constraint: focusing the text input must NOT scroll the canvas.

/** Activate the laser tool and switch the presentation annotation kind to text. */
async function activateLaserText(page: Page) {
  await page.goto("/");
  await expect(page.locator(".excalidraw")).toBeVisible();
  // The laser tool lives in the "More tools" toolbar dropdown.
  await page.locator(".App-toolbar__extra-tools-trigger").click();
  await page.locator('[data-testid="toolbar-laser"]').click();
  // The floating settings panel appears only while the laser tool is active.
  await expect(page.getByTestId("presentation-settings")).toBeVisible();
  await page.getByTestId("presentation-kind-text").click();
}

/**
 * Drag a text box on the right edge of the canvas with a large vertical drag
 * (drag height → font size). Right-edge + large font is exactly the case that
 * would scroll the canvas if the input were mounted in the scroll flow.
 */
async function dragLargeTextBoxAtRightEdge(page: Page) {
  const canvas = page.locator("canvas.excalidraw__canvas.interactive");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width - 60;
  const yTop = box.y + 140;
  const yBot = yTop + 160;
  await page.mouse.move(x, yTop);
  await page.mouse.down();
  await page.mouse.move(x, yBot, { steps: 8 });
  await page.mouse.up();
  return canvas;
}

/** Scroll state of `.excalidraw` and any scrollable ancestor (debug + guard). */
async function scrollState(page: Page) {
  return page.evaluate(() => {
    const out: {
      self: { left: number; top: number };
      ancestors: Record<string, number>;
    } = {
      self: { left: 0, top: 0 },
      ancestors: {},
    };
    const el = document.querySelector(".excalidraw") as HTMLElement | null;
    if (el) {
      out.self = { left: el.scrollLeft, top: el.scrollTop };
      let p = el.parentElement;
      while (p) {
        if (p.scrollLeft !== 0 || p.scrollTop !== 0) {
          out.ancestors[p.className.slice(0, 30) || p.tagName] = p.scrollLeft;
        }
        p = p.parentElement;
      }
    }
    return out;
  });
}

test.describe("presentation text annotation editor", () => {
  test.beforeEach(async ({ page }) => {
    await activateLaserText(page);
  });

  test("focusing the text input does not scroll .excalidraw (right-edge, large font)", async ({
    page,
  }) => {
    await dragLargeTextBoxAtRightEdge(page);
    const input = page.locator("input:not([type])");
    await expect(input).toBeVisible();

    const before = await scrollState(page);
    await input.focus();
    await page.waitForTimeout(150);
    const after = await scrollState(page);

    // The immutable constraint: focusing the input must not scroll the canvas.
    expect(after.self.left, ".excalidraw.scrollLeft").toBe(0);
    expect(after.self.top, ".excalidraw.scrollTop").toBe(0);
    // No scrollable ancestor should have shifted either.
    expect(
      Object.keys(after.ancestors).length,
      `ancestors scrolled: ${JSON.stringify({ before, after })}`,
    ).toBe(0);
  });

  test("Enter commits and closes the editor; Esc cancels and closes it", async ({
    page,
  }) => {
    await dragLargeTextBoxAtRightEdge(page);
    const input = page.locator("input:not([type])");
    await expect(input).toBeVisible();

    // Type, then Enter → editor unmounts (annotation committed).
    await input.fill("hello");
    await input.press("Enter");
    await expect(input).toHaveCount(0);

    // New text box, then Esc → editor unmounts (annotation cancelled).
    await dragLargeTextBoxAtRightEdge(page);
    const input2 = page.locator("input:not([type])");
    await expect(input2).toBeVisible();
    await input2.press("Escape");
    await expect(input2).toHaveCount(0);
  });

  test("typing updates the editor value (live preview wiring)", async ({
    page,
  }) => {
    await dragLargeTextBoxAtRightEdge(page);
    const input = page.locator("input:not([type])");
    await expect(input).toBeVisible();
    await input.fill("live text");
    await expect(input).toHaveValue("live text");
  });

  test("starting another annotation commits the open text (no second editor)", async ({
    page,
  }) => {
    // Open a text editor.
    await dragLargeTextBoxAtRightEdge(page);
    const input = page.locator("input:not([type])");
    await expect(input).toBeVisible();
    await input.fill("first");
    // Switch to a non-text kind so the next pointer interaction starts a
    // freehand trail (not a new text box) — this isolates "the open text was
    // committed and the editor closed" from "a new text editor opened".
    await page.getByTestId("presentation-kind-freehand").click();
    // Clicking the canvas (laser) commits the open text and starts a freehand
    // annotation; the editor must be gone and not reopen (freehand has none).
    const canvas = page.locator("canvas.excalidraw__canvas.interactive");
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator("input:not([type])")).toHaveCount(0);
  });

  test("the invisible editor does not block drags over its area (pointer pass-through)", async ({
    page,
  }) => {
    // Create a LARGE-font editor near the left so its (huge, transparent) box
    // has an on-screen centre. Default input width ≈ size(20) × fontSize, so a
    // ~200px font makes the editor thousands of pixels wide.
    const canvas = page.locator("canvas.excalidraw__canvas.interactive");
    const cbox = (await canvas.boundingBox())!;
    const x = cbox.x + 200;
    await page.mouse.move(x, cbox.y + 100);
    await page.mouse.down();
    await page.mouse.move(x, cbox.y + 300, { steps: 8 });
    await page.mouse.up();
    const input = page.locator("input:not([type])");
    await expect(input).toBeVisible();
    await input.fill("AAA");

    // A drag starting INSIDE the editor's transparent box must reach the canvas
    // (the editor must not intercept it). Before the fix this drag was swallowed
    // and the editor stayed on "AAA".
    const ibox = await input.boundingBox();
    const cx = ibox.x + 200;
    const cy = ibox.y + ibox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 5, cy + 60, { steps: 5 });
    await page.mouse.up();
    // Old "AAA" committed + a new (empty) editor opened → the drag was NOT blocked.
    await expect(page.locator("input:not([type])")).toHaveValue("");
  });

  test("committed text is painted to the overlay canvas (rendering-pipeline guard)", async ({
    page,
  }) => {
    // Guards the cached-layer rendering refactor: after commit the annotation
    // must actually appear on the overlay (stable layer rendered + composited).
    await dragLargeTextBoxAtRightEdge(page);
    const input = page.locator("input:not([type])");
    await input.fill("hello");
    await input.press("Enter");
    await page.waitForFunction(
      () => {
        const c = document.querySelector(
          "canvas.presentation-trails",
        ) as HTMLCanvasElement | null;
        if (!c) {
          return false;
        }
        const ctx = c.getContext("2d");
        if (!ctx) {
          return false;
        }
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] !== 0) {
            return true; // at least one non-transparent pixel painted
          }
        }
        return false;
      },
      undefined,
      { timeout: 5000 },
    );
  });

  // NOTE on pan/zoom follow (user story 7): the editor's position is derived
  // from the annotation's scene coordinates on every render via
  // sceneCoordsToViewportCoords (which is zoom/scroll-aware). #03 leaves that
  // derivation untouched; #04 only switches its source from an AppState
  // snapshot to the PresentationTrails instance — same derivation, so the
  // editor still tracks the viewport. Not asserted here as an e2e because
  // driving Excalidraw's ctrl+wheel zoom from Playwright proved unreliable,
  // and the behaviour is preserved by construction rather than at risk.
});
