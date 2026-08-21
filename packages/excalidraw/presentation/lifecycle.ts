import { easeOut } from "@excalidraw/common";

import type { AnnotationLifecycle, LifecycleOptions } from "./types";

/**
 * Overall opacity `[0, 1]` for an annotation at time `now`.
 *
 * - With `holdToPersist`, an annotation whose pointer is still down
 *   (`releasedAt == null`) stays fully opaque.
 * - After release, opacity eases from 1 → 0 over `decayMs`, starting at the
 *   release moment (or at `bornAt` when `holdToPersist` is disabled).
 *
 * Colour distribution is orthogonal to this — callers apply this alpha on top
 * of whatever colour strategy they use.
 */
export const computeAnnotationAlpha = (
  annotation: AnnotationLifecycle,
  now: number,
  options: LifecycleOptions,
): number => {
  // Held down + hold-to-persist: freeze, no decay.
  if (options.holdToPersist && annotation.releasedAt == null) {
    return 1;
  }

  // ∞ fade (decayMs <= 0): the annotation never fades out.
  if (options.decayMs <= 0) {
    return 1;
  }

  const decayStart = options.holdToPersist
    ? annotation.releasedAt ?? now
    : annotation.bornAt;

  const remaining = 1 - (now - decayStart) / options.decayMs;
  return easeOut(Math.max(0, Math.min(1, remaining)));
};

/** An annotation should be removed once its opacity has fully faded out. */
export const shouldRemoveAnnotation = (alpha: number): boolean => alpha <= 0;
