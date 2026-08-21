import React from "react";

/**
 * Uncontrolled text editor for a single in-progress presentation text
 * annotation.
 *
 * This component is deliberately presentational: it owns no domain state and
 * receives its viewport position/font size plus three callbacks as props. The
 * position is derived from the annotation held by `PresentationTrails` (the
 * single source of truth) by the parent each render — never stored in AppState.
 *
 * The input is uncontrolled (`defaultValue`), so typing updates the DOM value
 * directly; the parent wires `onChange` to mirror the value into the trail for
 * the live canvas preview. Because the component never calls `setAppState`, a
 * keystroke cannot trigger an App-level rerender.
 *
 * The editor stays mounted at `position: fixed` in the viewport layer (NOT
 * inside `.excalidraw`'s scroll flow): mounting it in-flow would let
 * `focus()` scroll the canvas. See docs/presentation-text-editor-state.md.
 */
export interface PresentationTextInputProps {
  left: number;
  top: number;
  fontSize: number;
  /** Fired on every keystroke with the current input value (drives the live
   * canvas preview). Must NOT mutate AppState. */
  onChange: (value: string) => void;
  /** Commit the annotation (Enter or blur). */
  onCommit: () => void;
  /** Cancel the annotation (Esc). */
  onCancel: () => void;
}

const inputStyle = (
  left: number,
  top: number,
  fontSize: number,
): React.CSSProperties => ({
  position: "fixed",
  left,
  top,
  fontSize,
  lineHeight: 1,
  color: "transparent",
  caretColor: "#333",
  background: "transparent",
  border: "none",
  outline: "none",
  boxShadow: "none",
  appearance: "none",
  WebkitAppearance: "none",
  padding: 0,
  margin: 0,
  fontFamily: "sans-serif",
  zIndex: 10,
  // The editor text is transparent (the canvas draws the real text), so the
  // input only exists to capture keystrokes and show a caret — it must NOT
  // intercept pointer events. Its default width is ~size(20) × fontSize, which
  // for a large-font annotation is thousands of pixels: an invisible dead zone
  // that blocks drags which should reach the canvas to start the next
  // annotation. `none` lets pointers pass through; keyboard/caret/autofocus are
  // unaffected (focus is programmatic, not pointer-driven).
  pointerEvents: "none",
});

export const PresentationTextInput = ({
  left,
  top,
  fontSize,
  onChange,
  onCommit,
  onCancel,
}: PresentationTextInputProps) => (
  <input
    style={inputStyle(left, top, fontSize)}
    defaultValue=""
    autoFocus
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onCommit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }}
    onBlur={onCommit}
  />
);
