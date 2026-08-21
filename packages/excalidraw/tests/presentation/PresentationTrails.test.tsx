import { Excalidraw } from "../../index";
import { Pointer } from "../helpers/ui";
import { act, fireEvent, render } from "../test-utils";

import type { AnnotationKind } from "../../presentation/types";

// Local annotation drawing for the laser tool is handled by PresentationTrails
// (pen / line / rect / ellipse / text). These cover its state lifecycle — the
// parts that matter for correctness — without asserting on canvas pixels
// (which jsdom cannot render anyway).

const h = window.h;
const mouse = new Pointer("mouse");

describe("PresentationTrails — laser tool local annotations", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });
  });

  it("freehand (default): pointer down starts a trail, pointer up commits it", () => {
    mouse.downAt(30, 30);
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(true);
    mouse.moveTo(80, 80);
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(true);
    // freehand commits on release → the trail moves to `past` and fades out
    mouse.upAt(80, 80);
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(false);
  });

  it.each(["line", "rectangle", "ellipse"] as const satisfies AnnotationKind[])(
    "%s: pointer down starts, pointer up commits",
    (kind) => {
      act(() => {
        h.app.setAppState({ currentPresentationKind: kind });
      });
      mouse.downAt(30, 30);
      expect(h.app.presentationTrails.hasCurrentTrail).toBe(true);
      mouse.moveTo(100, 100);
      mouse.upAt(100, 100);
      expect(h.app.presentationTrails.hasCurrentTrail).toBe(false);
    },
  );

  it("text: pointer up enters edit mode — the trail is held, not committed", () => {
    act(() => {
      h.app.setAppState({ currentPresentationKind: "text" });
    });
    mouse.downAt(30, 30);
    mouse.moveTo(30, 70); // vertical drag defines the font size
    mouse.upAt(30, 70);
    // text does NOT commit on release; it waits for the input box
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(true);
    expect(h.app.presentationTrails.isEditingText).toBe(true);
    const pos = h.app.presentationTrails.getEditingTextPos();
    expect(pos).not.toBeNull();
    expect(pos!.fontSize).toBeGreaterThanOrEqual(16);
  });

  it("text: committing non-empty content commits the trail", () => {
    act(() => {
      h.app.setAppState({ currentPresentationKind: "text" });
    });
    mouse.downAt(30, 30);
    mouse.moveTo(30, 70);
    mouse.upAt(30, 70);
    h.app.presentationTrails.updateCurrentText("hello");
    h.app.presentationTrails.commitCurrentText();
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(false);
    expect(h.app.presentationTrails.isEditingText).toBe(false);
  });

  it("text: committing empty content cancels (draws nothing)", () => {
    act(() => {
      h.app.setAppState({ currentPresentationKind: "text" });
    });
    mouse.downAt(30, 30);
    mouse.moveTo(30, 70);
    mouse.upAt(30, 70);
    // no content typed → commit falls back to cancel
    h.app.presentationTrails.commitCurrentText();
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(false);
    expect(h.app.presentationTrails.isEditingText).toBe(false);
  });

  it("text: cancelCurrentText clears the in-progress trail", () => {
    act(() => {
      h.app.setAppState({ currentPresentationKind: "text" });
    });
    mouse.downAt(30, 30);
    mouse.moveTo(30, 70);
    mouse.upAt(30, 70);
    h.app.presentationTrails.cancelCurrentText();
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(false);
    expect(h.app.presentationTrails.isEditingText).toBe(false);
  });

  // Invariant: once text editing has ended (commit or cancel), it stays ended.
  // This is what makes the blur + click-elsewhere interplay safe: the input's
  // onBlur commits, then App.onPointerDown (laser) commits again — the second
  // commit must be a no-op so the same text is never drawn twice.
  it("text: commit/cancel are idempotent once editing has ended (no double-draw)", () => {
    act(() => {
      h.app.setAppState({ currentPresentationKind: "text" });
    });
    mouse.downAt(30, 30);
    mouse.moveTo(30, 70);
    mouse.upAt(30, 70);
    h.app.presentationTrails.updateCurrentText("hello");
    h.app.presentationTrails.commitCurrentText();
    expect(h.app.presentationTrails.isEditingText).toBe(false);
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(false);

    // A repeat commit (the blur-then-pointerDown double-fire) must not resurrect
    // editing or re-add a trail.
    h.app.presentationTrails.commitCurrentText();
    expect(h.app.presentationTrails.isEditingText).toBe(false);
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(false);

    // Cancel after the fact is likewise a safe no-op.
    h.app.presentationTrails.cancelCurrentText();
    expect(h.app.presentationTrails.isEditingText).toBe(false);
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(false);
  });

  // End-to-end through the React layer: App raises the render gate on pointer-up,
  // LayerUI mounts the editor, typing mirrors into the trail WITHOUT lowering the
  // gate (no AppState per keystroke), and Enter commits + lowers the gate.
  it("text: editor drives the trail end-to-end (gate raises, typing keeps it up, Enter commits)", () => {
    act(() => {
      h.app.setAppState({ currentPresentationKind: "text" });
    });
    mouse.downAt(30, 30);
    mouse.moveTo(30, 70);
    mouse.upAt(30, 70);
    // pointer-up raised the render gate and mounted the <input>
    expect(h.app.state.isEditingPresentationText).toBe(true);
    const input = document.querySelector(
      "input:not([type])",
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    // typing reaches the trail and must not touch the gate
    act(() => {
      fireEvent.change(input, { target: { value: "hello" } });
    });
    expect(h.app.state.isEditingPresentationText).toBe(true);
    // Enter commits the (non-empty) content and lowers the gate
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(false);
    expect(h.app.presentationTrails.isEditingText).toBe(false);
    expect(h.app.state.isEditingPresentationText).toBe(false);
  });

  it("gradient color strategy does not disrupt the freehand lifecycle", () => {
    act(() => {
      h.app.setAppState({
        presentationColorStrategy: { mode: "gradient" },
      });
    });
    mouse.downAt(30, 30);
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(true);
    mouse.moveTo(80, 80);
    mouse.upAt(80, 80);
    expect(h.app.presentationTrails.hasCurrentTrail).toBe(false);
  });
});
