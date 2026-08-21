import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PresentationTextInput } from "../../components/PresentationTextInput";

// The editor input is a pure, presentational component: it holds no domain
// state and receives position + three callbacks. These lock its callback
// contract — the guarantee the convergence refactor relies on (typing cannot
// reach AppState; only Enter/blur commit, only Esc cancels).
describe("PresentationTextInput", () => {
  const baseProps = { left: 10, top: 20, fontSize: 16 };

  const mount = (
    overrides: Partial<{
      onChange: ReturnType<typeof vi.fn>;
      onCommit: ReturnType<typeof vi.fn>;
      onCancel: ReturnType<typeof vi.fn>;
    }> = {},
  ) => {
    const onChange = overrides.onChange ?? vi.fn();
    const onCommit = overrides.onCommit ?? vi.fn();
    const onCancel = overrides.onCancel ?? vi.fn();
    const utils = render(
      <PresentationTextInput
        {...baseProps}
        onChange={onChange}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    return {
      input: utils.getByRole("textbox") as HTMLInputElement,
      onChange,
      onCommit,
      onCancel,
    };
  };

  it("typing fires onChange with the value and nothing else", () => {
    const { input, onChange, onCommit, onCancel } = mount();
    fireEvent.change(input, { target: { value: "hi" } });
    expect(onChange).toHaveBeenCalledWith("hi");
    expect(onChange).toHaveBeenCalledTimes(1);
    // A keystroke must not commit or cancel — the component has no AppState,
    // so typing cannot lower the render gate or otherwise mutate app state.
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("Enter commits and does not cancel", () => {
    const { input, onCommit, onCancel } = mount();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("Escape cancels and does not commit", () => {
    const { input, onCommit, onCancel } = mount();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("blur commits", () => {
    const { input, onCommit } = mount();
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
