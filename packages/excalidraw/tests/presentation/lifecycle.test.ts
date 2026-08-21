import {
  computeAnnotationAlpha,
  shouldRemoveAnnotation,
} from "../../presentation/lifecycle";

import type {
  AnnotationLifecycle,
  LifecycleOptions,
} from "../../presentation/types";

const holdOptions = (decayMs = 1000): LifecycleOptions => ({
  decayMs,
  holdToPersist: true,
});

describe("computeAnnotationAlpha (holdToPersist)", () => {
  it("stays fully opaque while the pointer is still held down", () => {
    const held: AnnotationLifecycle = { bornAt: 0, releasedAt: null };
    // arbitrarily far in the future, still held → never decays
    expect(computeAnnotationAlpha(held, 999_999, holdOptions())).toBe(1);
  });

  it("is fully opaque at the exact moment of release", () => {
    const a: AnnotationLifecycle = { bornAt: 0, releasedAt: 1000 };
    expect(computeAnnotationAlpha(a, 1000, holdOptions())).toBeCloseTo(1);
  });

  it("fades to 0 after decayMs has elapsed since release", () => {
    const a: AnnotationLifecycle = { bornAt: 0, releasedAt: 1000 };
    expect(computeAnnotationAlpha(a, 2000, holdOptions(1000))).toBe(0);
    expect(shouldRemoveAnnotation(0)).toBe(true);
  });

  it("produces an intermediate, eased value halfway through decay", () => {
    const a: AnnotationLifecycle = { bornAt: 0, releasedAt: 1000 };
    const alpha = computeAnnotationAlpha(a, 1500, holdOptions(1000));
    // ease-out curves above the diagonal: strictly between 0.5 and 1
    expect(alpha).toBeGreaterThan(0.5);
    expect(alpha).toBeLessThan(1);
  });
});

describe("computeAnnotationAlpha (holdToPersist disabled)", () => {
  it("decays from bornAt regardless of whether the pointer is held", () => {
    const noHold: LifecycleOptions = { decayMs: 1000, holdToPersist: false };
    const held: AnnotationLifecycle = { bornAt: 0, releasedAt: null };
    // 1000ms after birth → fully faded even while still held
    expect(computeAnnotationAlpha(held, 1000, noHold)).toBe(0);
  });
});
