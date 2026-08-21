// Presentation annotation domain types.
//
// The laser tool (`activeTool.type === "laser"`) is the entry point for all
// presentation annotations. The specific shape being drawn is a sub-state
// (`AnnotationKind`), not a separate top-level tool.

/** 2D point in scene coordinates. */
export type Point = { x: number; y: number };

/** Shape a presentation annotation can take. */
export type AnnotationKind =
  | "freehand"
  | "line"
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "text";

/** Arrowhead style for line / pen annotations. */
export type PresentationArrowStyle = "none" | "filled" | "open";

/**
 * Color strategy for an annotation. `single` is a flat colour the user picks;
 * `gradient` is a fixed rainbow (HSL hue cycle) — not user-tunable, only a
 * mode toggle. Pen spreads the whole rainbow along its trail length; other
 * shapes take a short segment of a shared, distance-driven global phase.
 */
export type ColorStrategy =
  | { mode: "single"; color: string }
  | { mode: "gradient" };

/** Lifecycle parameters shared by every annotation kind. */
export type LifecycleOptions = {
  /** How long (ms) an annotation keeps fading out after the pointer is released. */
  decayMs: number;
  /**
   * When true, an annotation held down (pointer still pressed) does not decay;
   * decay only starts after release. When false, decay starts at creation.
   */
  holdToPersist: boolean;
};

/**
 * Lifecycle bookkeeping for a single annotation. Times are `performance.now()`
 * epochs. `releasedAt` is `null` while the pointer is still held down.
 */
export type AnnotationLifecycle = {
  bornAt: number;
  releasedAt: number | null;
};

/** Default presentation preferences (close to current laser behaviour). */
export const DEFAULT_PRESENTATION_KIND: AnnotationKind = "freehand";
export const DEFAULT_PRESENTATION_STROKE = 12;
export const DEFAULT_PRESENTATION_ARROW: PresentationArrowStyle = "none";
export const DEFAULT_PRESENTATION_DECAY_MS = 1000;
export const DEFAULT_COLOR_STRATEGY: ColorStrategy = {
  mode: "single",
  color: "#ff0000",
};
