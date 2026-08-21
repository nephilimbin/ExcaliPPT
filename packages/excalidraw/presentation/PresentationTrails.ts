import { LaserPointer } from "@excalidraw/laser-pointer";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import { computeAnnotationAlpha, shouldRemoveAnnotation } from "./lifecycle";
import { rainbow } from "./colorStrategy";

import type { Point } from "./types";

import type App from "../components/App";
import type { AppState } from "../types";

/** Scene units of drawn length that advance the rainbow phase by one full cycle
 * (360°). Lower = colours change faster along the trail / across shapes.
 * Measured in scene (not screen) units, so the on-screen colour cycle scales
 * with zoom: zooming in spreads one cycle over more screen pixels (slower
 * change), zooming out over fewer (faster change). */
const RAINBOW_DISTANCE = 1600;
/** Fixed hue span for line/rect/ellipse gradients (start colour → end colour).
 * 1/6 = 60° (e.g. red → yellow). Unlike pen, a shape uses only two main
 * colours: drag distance picks the start colour, this span picks the end. */
const SHAPE_GRADIENT_SPAN = 1 / 6;
/** How far back along a freehand trail the arrowhead samples its direction.
 * Larger = steadier angle (ignores fine end-of-stroke wobble); smaller = more
 * responsive to the local direction. The raw last-two-points default is noisy. */
const ARROW_DIR_DIST = 24;

type Geometry =
  | { kind: "freehand"; laserPointer: LaserPointer }
  | { kind: "line"; from: Point; to: Point }
  | { kind: "rectangle"; from: Point; to: Point }
  | { kind: "ellipse"; from: Point; to: Point }
  | { kind: "triangle"; from: Point; to: Point }
  | { kind: "text"; from: Point; to: Point; content: string; fontSize: number };

type PresentationAnnotation = {
  geometry: Geometry;
  bornAt: number;
  releasedAt: number | null;
  /** Rainbow phase captured when this annotation started drawing. */
  colorPhase: number;
  /** Text only: true once the pointer is released and the input box is open. */
  editing?: boolean;
};

/**
 * Renders presentation annotations (pen / line / rect / ellipse) to a single
 * <canvas> overlaid on the SVG layer.
 *
 * Rendering: freehand draws segment by segment with a per-distance colour, so
 * the trail is one continuous stroke with no seams between colour bands; the
 * whole annotation then fades out together (unlike per-segment SVG paths).
 *
 * Colour strategy (rainbow mode):
 *  - Pen sweeps the whole spectrum along its trail length.
 *  - Line/rect/ellipse use only two main colours: the drag distance picks the
 *    start colour, the fixed SHAPE_GRADIENT_SPAN picks the end colour.
 *  - A global `colorPhase` cursor is carried across annotations so each new
 *    stroke/shape continues from where the previous one ended (never
 *    restarting at red); see `tipPhase()` and the endPath advance.
 *
 * Stroke size (`presentationStrokeSize`) is the pen width; line/rect/ellipse
 * use size / 1.5 (kept thinner — a 1.5:1 pen-to-line visual ratio).
 */
export class PresentationTrails {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;
  private current?: PresentationAnnotation;
  private past: PresentationAnnotation[] = [];
  private colorPhase = 0;
  // Own rAF loop (see scheduleFrame) rather than the shared AnimationController.
  private rafId: number | null = null;
  // Cached layer for all `past` annotations: they share one fade alpha (every
  // commit/cancel/hold resets releasedAt for the whole set together), so a
  // single offscreen canvas can composite them each frame with one drawImage
  // instead of re-rendering every annotation every frame. Re-rendered only when
  // the visible set, viewport, or style settings change (see renderKey).
  private stableCanvas?: HTMLCanvasElement;
  private stableCtx?: CanvasRenderingContext2D;
  private stableKey = "";
  private stableVersion = 0;

  constructor(private app: App) {}

  /**
   * The SVGLayer passes its <svg>; we mount our canvas as a sibling (on top)
   * so it covers the same viewport area.
   */
  start(host: SVGSVGElement) {
    const parent = host.parentElement;
    if (!parent) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.className = "presentation-trails";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    parent.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d") ?? undefined;
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.canvas?.remove();
    this.canvas = undefined;
    this.ctx = undefined;
    this.stableCanvas?.remove();
    this.stableCanvas = undefined;
    this.stableCtx = undefined;
    this.stableKey = "";
    this.past = [];
    this.current = undefined;
  }

  get hasCurrentTrail() {
    return !!this.current;
  }

  startPath(x: number, y: number) {
    // Pressing the pointer resets every existing trail's fade timer and pauses
    // it (releasedAt == null → full alpha) for as long as the pointer is held,
    // so the whole set stays visible together while drawing.
    for (const a of this.past) {
      a.releasedAt = null;
    }
    const state = this.app.state;
    const point = { x, y };
    let geometry: Geometry;
    if (state.currentPresentationKind === "freehand") {
      const laserPointer = new LaserPointer({
        size: state.presentationStrokeSize,
        streamline: 0.4,
        simplify: 0,
      } as Partial<LaserPointerOptions>);
      laserPointer.addPoint([x, y, performance.now()]);
      geometry = { kind: "freehand", laserPointer };
    } else if (state.currentPresentationKind === "line") {
      geometry = { kind: "line", from: point, to: point };
    } else if (state.currentPresentationKind === "rectangle") {
      geometry = { kind: "rectangle", from: point, to: point };
    } else if (state.currentPresentationKind === "ellipse") {
      geometry = { kind: "ellipse", from: point, to: point };
    } else if (state.currentPresentationKind === "triangle") {
      geometry = { kind: "triangle", from: point, to: point };
    } else if (state.currentPresentationKind === "text") {
      geometry = {
        kind: "text",
        from: point,
        to: point,
        content: "",
        fontSize: 16,
      };
    } else {
      // 兜底:未知 kind 落椭圆(保持原默认行为)
      geometry = { kind: "ellipse", from: point, to: point };
    }
    this.current = {
      geometry,
      bornAt: performance.now(),
      releasedAt: null,
      colorPhase: this.colorPhase,
    };
    this.scheduleFrame();
  }

  addPointToPath(x: number, y: number) {
    if (!this.current) {
      return;
    }
    const geometry = this.current.geometry;
    if (geometry.kind === "freehand") {
      geometry.laserPointer.addPoint([x, y, performance.now()]);
    } else {
      geometry.to = { x, y };
    }
    this.scheduleFrame();
  }

  endPath() {
    if (!this.current) {
      return;
    }
    const geometry = this.current.geometry;
    if (geometry.kind === "freehand") {
      geometry.laserPointer.close();
      geometry.laserPointer.options.keepHead = false;
      this.colorPhase += this.shapeLength(geometry) / RAINBOW_DISTANCE;
      this.commitNow();
    } else if (geometry.kind === "text") {
      // text enters edit mode on release (input box opens); it is not faded or
      // committed here — committed on Enter, cancelled on Esc.
      const h = Math.abs(geometry.to.y - geometry.from.y);
      geometry.fontSize = Math.max(16, Math.round(h));
      this.current.editing = true;
    } else {
      // line/rect/ellipse: advance by drag distance + fixed span so the next
      // annotation continues from this one's end colour.
      const dragDist = Math.hypot(
        geometry.to.x - geometry.from.x,
        geometry.to.y - geometry.from.y,
      );
      this.colorPhase += dragDist / RAINBOW_DISTANCE + SHAPE_GRADIENT_SPAN;
      this.commitNow();
    }
    this.scheduleFrame();
  }

  /** Move the current annotation into `past` and (re)start its fade now. */
  private commitNow() {
    if (!this.current) {
      return;
    }
    this.past.push(this.current);
    this.current = undefined;
    this.stableVersion++; // a new annotation entered the cached layer
    // Release restarts every trail's fade from now, so the whole set fades out
    // together (not each from its own earlier release time).
    const now = performance.now();
    for (const a of this.past) {
      a.releasedAt = now;
    }
  }

  // --- text editing (input box is open after the pointer is released) ---
  get isEditingText() {
    return (
      !!this.current &&
      this.current.geometry.kind === "text" &&
      !!this.current.editing
    );
  }

  getEditingTextPos(): { x: number; y: number; fontSize: number } | null {
    if (!this.current || this.current.geometry.kind !== "text") {
      return null;
    }
    const g = this.current.geometry;
    return {
      x: Math.min(g.from.x, g.to.x),
      y: Math.min(g.from.y, g.to.y),
      fontSize: g.fontSize,
    };
  }

  updateCurrentText(content: string) {
    if (this.current?.geometry.kind === "text") {
      this.current.geometry.content = content;
      this.scheduleFrame();
    }
  }

  /** Commit on Enter / blur. Empty content → cancel (draws nothing). */
  commitCurrentText() {
    if (
      this.current?.geometry.kind === "text" &&
      this.current.geometry.content.length > 0
    ) {
      this.current.editing = false;
      this.colorPhase += SHAPE_GRADIENT_SPAN;
      this.commitNow();
      this.scheduleFrame();
    } else {
      this.cancelCurrentText();
    }
  }

  cancelCurrentText() {
    if (this.current?.geometry.kind === "text") {
      this.current = undefined;
      // A cancelled text adds nothing, so whatever was paused (startPath had
      // set releasedAt=null to hold it while drawing) should resume fading now
      // that nothing is being edited anymore.
      const now = performance.now();
      for (const a of this.past) {
        a.releasedAt = now;
      }
      this.scheduleFrame();
    }
  }

  private shapeLength(geometry: Geometry): number {
    switch (geometry.kind) {
      case "freehand": {
        const pts = geometry.laserPointer.originalPoints;
        let len = 0;
        for (let i = 1; i < pts.length; i++) {
          len += Math.hypot(
            pts[i][0] - pts[i - 1][0],
            pts[i][1] - pts[i - 1][1],
          );
        }
        return len;
      }
      case "line":
        return Math.hypot(
          geometry.to.x - geometry.from.x,
          geometry.to.y - geometry.from.y,
        );
      case "rectangle": {
        const w = Math.abs(geometry.to.x - geometry.from.x);
        const h = Math.abs(geometry.to.y - geometry.from.y);
        return 2 * (w + h);
      }
      case "ellipse": {
        const rx = Math.abs(geometry.to.x - geometry.from.x) / 2;
        const ry = Math.abs(geometry.to.y - geometry.from.y) / 2;
        return Math.PI * (rx + ry);
      }
      case "triangle": {
        const w = Math.abs(geometry.to.x - geometry.from.x);
        const h = Math.abs(geometry.to.y - geometry.from.y);
        return w + 2 * Math.hypot(w / 2, h);
      }
      case "text":
        return 0;
    }
  }

  /** Rainbow phase at the tip (end) of an annotation — the colour used by the
   * arrowhead and the gradient's far stop. For freehand it follows the full
   * trail length (pen sweeps the spectrum); for line/rect/ellipse it is the
   * drag-distance-driven start phase plus the fixed two-colour span. */
  private tipPhase(annotation: PresentationAnnotation): number {
    const g = annotation.geometry;
    if (g.kind === "freehand") {
      return annotation.colorPhase + this.shapeLength(g) / RAINBOW_DISTANCE;
    }
    const dragDist = Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y);
    return (
      annotation.colorPhase + dragDist / RAINBOW_DISTANCE + SHAPE_GRADIENT_SPAN
    );
  }

  private scheduleFrame() {
    // Drive our own rAF loop instead of the shared AnimationController, which
    // falls back to setTimeout(0) when render throttling is disabled (the
    // default in this app) — that ticked the overlay far faster than the display
    // refresh, amplifying the per-frame redraw cost. rAF is refresh-aligned.
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private tick = () => {
    this.rafId = null;
    if (this.onFrame()) {
      this.scheduleFrame();
    }
  };

  private onFrame(): boolean {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) {
      return false;
    }
    const state = this.app.state;
    const dpr = window.devicePixelRatio || 1;
    const w = state.width;
    const h = state.height;
    if (
      canvas.width !== Math.round(w * dpr) ||
      canvas.height !== Math.round(h * dpr)
    ) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const now = performance.now();
    const decayMs = state.presentationDecayMs;

    // All `past` annotations share one releasedAt (reset together on every
    // commit/cancel/hold), so they share a single fade alpha. Drop faded ones,
    // then composite the rest from the cached layer with that one alpha — no
    // per-annotation measureText/fillText/per-segment gradient every frame.
    let pastAlpha = 1;
    if (this.past.length > 0) {
      let removed = false;
      this.past = this.past.filter((annotation) => {
        const alpha = computeAnnotationAlpha(
          { bornAt: annotation.bornAt, releasedAt: annotation.releasedAt },
          now,
          { decayMs, holdToPersist: true },
        );
        if (shouldRemoveAnnotation(alpha)) {
          removed = true;
          return false;
        }
        pastAlpha = alpha;
        return true;
      });
      if (removed) {
        this.stableVersion++; // membership changed → cached layer is stale
      }
    }

    // (Re)render the cached layer only when the visible set, viewport, or style
    // settings changed; otherwise reuse it (one drawImage blit per frame).
    this.ensureStableCanvas(w, h, dpr);
    const key = this.renderKey(state, dpr);
    if (this.past.length > 0 && this.stableCtx && key !== this.stableKey) {
      const sctx = this.stableCtx;
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.clearRect(0, 0, w, h);
      for (const annotation of this.past) {
        this.drawAnnotation(sctx, annotation, 1, state);
      }
      this.stableKey = key;
    }

    if (this.past.length > 0 && this.stableCanvas) {
      ctx.globalAlpha = pastAlpha;
      ctx.drawImage(this.stableCanvas, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    // The in-progress annotation is drawn live (its geometry/content changes as
    // you draw/edit) — never cached.
    if (this.current) {
      this.drawAnnotation(ctx, this.current, 1, state);
    }
    return this.past.length > 0 || !!this.current;
  }

  private ensureStableCanvas(w: number, h: number, dpr: number) {
    if (!this.stableCanvas) {
      this.stableCanvas = document.createElement("canvas");
      this.stableCtx = this.stableCanvas.getContext("2d") ?? undefined;
    }
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    if (this.stableCanvas.width !== W || this.stableCanvas.height !== H) {
      // Resizing clears the canvas; renderKey includes w/h so the next check
      // re-renders it.
      this.stableCanvas.width = W;
      this.stableCanvas.height = H;
    }
  }

  // The cached layer needs re-rendering when anything that changes its pixels
  // changes: the set of past annotations (stableVersion), the viewport (so
  // annotations track pan/zoom — zoom is a {value} object, so use .value), the
  // canvas size (a resize clears the layer), or the style settings. Encoded as a
  // string for a cheap equality check each frame.
  private renderKey(state: AppState, dpr: number): string {
    const c = state.presentationColorStrategy;
    return [
      dpr,
      state.width,
      state.height,
      state.zoom.value,
      state.scrollX,
      state.scrollY,
      state.offsetLeft,
      state.offsetTop,
      state.presentationStrokeSize,
      state.presentationArrowStyle,
      c.mode,
      c.mode === "single" ? c.color : "",
      this.stableVersion,
    ].join("|");
  }

  private drawAnnotation(
    ctx: CanvasRenderingContext2D,
    annotation: PresentationAnnotation,
    alpha: number,
    state: AppState,
  ) {
    ctx.globalAlpha = alpha;
    const geometry = annotation.geometry;
    if (geometry.kind === "freehand") {
      this.drawFreehand(ctx, geometry, annotation.colorPhase, state);
    } else if (geometry.kind === "text") {
      this.drawText(ctx, annotation, state);
    } else {
      this.drawShape(ctx, annotation, state);
    }
    const wantArrow =
      state.presentationArrowStyle !== "none" &&
      (geometry.kind === "line" || geometry.kind === "freehand");
    if (wantArrow) {
      this.drawArrow(ctx, annotation, state);
    }
    ctx.globalAlpha = 1;
  }

  private drawFreehand(
    ctx: CanvasRenderingContext2D,
    geometry: Extract<Geometry, { kind: "freehand" }>,
    colorPhase: number,
    state: AppState,
  ) {
    const width = state.presentationStrokeSize;
    const strategy = state.presentationColorStrategy;
    const pts = geometry.laserPointer.originalPoints;
    const vp = pts.map(([x, y]) =>
      sceneCoordsToViewportCoords({ sceneX: x, sceneY: y }, state),
    );
    if (vp.length === 0) {
      return;
    }
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (strategy.mode === "single") {
      ctx.strokeStyle = strategy.color;
      ctx.beginPath();
      ctx.moveTo(vp[0].x, vp[0].y);
      for (let i = 1; i < vp.length; i++) {
        ctx.lineTo(vp[i].x, vp[i].y);
      }
      ctx.stroke();
      return;
    }
    // Rainbow: stroke segment by segment. Phase = this annotation's starting
    // phase + cumulative scene distance, on the same basis as the global
    // colorPhase cursor, so a new stroke continues from the colour where the
    // previous one ended (not restarting at red). butt caps (no half-circle
    // dots at shared endpoints) and each segment overlaps into the next point
    // so the joint at turns is covered — no dots, no gaps.
    ctx.lineCap = "butt";
    let cum = 0;
    for (let i = 1; i < vp.length; i++) {
      const prevCum = cum;
      cum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      // Gradient along this segment, from the previous point's phase to this
      // point's phase, so colour blends within the segment. Adjacent segments
      // share the phase at the shared endpoint → smooth gradient across the
      // whole trail (no band-to-band step).
      const grad = ctx.createLinearGradient(
        vp[i - 1].x,
        vp[i - 1].y,
        vp[i].x,
        vp[i].y,
      );
      grad.addColorStop(0, rainbow(colorPhase + prevCum / RAINBOW_DISTANCE));
      grad.addColorStop(1, rainbow(colorPhase + cum / RAINBOW_DISTANCE));
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(vp[i - 1].x, vp[i - 1].y);
      ctx.lineTo(vp[i].x, vp[i].y);
      if (i < vp.length - 1) {
        ctx.lineTo(vp[i + 1].x, vp[i + 1].y);
      }
      ctx.stroke();
    }
    // Round only the trail's two ends (not every joint — rounding every joint
    // brings back the half-circle dots at turns). Same phase colour as the
    // adjacent point so the cap blends with its segment.
    const drawEndCap = (pt: Point, phase: number) => {
      ctx.fillStyle = rainbow(phase);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, width / 2, 0, Math.PI * 2);
      ctx.fill();
    };
    drawEndCap(vp[0], colorPhase);
    drawEndCap(vp[vp.length - 1], colorPhase + cum / RAINBOW_DISTANCE);
  }

  private drawShape(
    ctx: CanvasRenderingContext2D,
    annotation: PresentationAnnotation,
    state: AppState,
  ) {
    const geometry = annotation.geometry;
    // freehand is routed to drawFreehand by drawAnnotation, so this never fires
    // at runtime — but it narrows the Geometry union so `from`/`to` below
    // type-check (freehand has neither). Kept as a type guard; do not remove.
    if (geometry.kind === "freehand") {
      return;
    }
    const width = state.presentationStrokeSize / 1.5;
    const strategy = state.presentationColorStrategy;
    const from = sceneCoordsToViewportCoords(
      { sceneX: geometry.from.x, sceneY: geometry.from.y },
      state,
    );
    const to = sceneCoordsToViewportCoords(
      { sceneX: geometry.to.x, sceneY: geometry.to.y },
      state,
    );
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (strategy.mode === "single") {
      ctx.strokeStyle = strategy.color;
    } else {
      // Two-colour gradient: drag distance picks the start colour, the fixed
      // SHAPE_GRADIENT_SPAN picks the end colour (not the shape's full length,
      // so a shape never spans many colours like a pen stroke does).
      const end = this.tipPhase(annotation);
      const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      grad.addColorStop(0, rainbow(end - SHAPE_GRADIENT_SPAN));
      grad.addColorStop(1, rainbow(end));
      ctx.strokeStyle = grad;
    }
    ctx.beginPath();
    if (geometry.kind === "line") {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    } else if (geometry.kind === "rectangle") {
      const x = Math.min(from.x, to.x);
      const y = Math.min(from.y, to.y);
      ctx.rect(x, y, Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    } else if (geometry.kind === "triangle") {
      // 等腰·顶点上:复用 rect 的 min+abs 包围盒,顶点在上中、两底角在下
      const x = Math.min(from.x, to.x);
      const y = Math.min(from.y, to.y);
      const w = Math.abs(to.x - from.x);
      const h = Math.abs(to.y - from.y);
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
    } else {
      const cx = (from.x + to.x) / 2;
      const cy = (from.y + to.y) / 2;
      const rx = Math.abs(to.x - from.x) / 2;
      const ry = Math.abs(to.y - from.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  private drawText(
    ctx: CanvasRenderingContext2D,
    annotation: PresentationAnnotation,
    state: AppState,
  ) {
    const g = annotation.geometry;
    if (g.kind !== "text") {
      return;
    }
    const from = sceneCoordsToViewportCoords(
      { sceneX: g.from.x, sceneY: g.from.y },
      state,
    );
    const strategy = state.presentationColorStrategy;
    const phaseColor = () =>
      strategy.mode === "single"
        ? strategy.color
        : rainbow(annotation.colorPhase);
    const applyGradient = (text: string) => {
      const w = Math.max(20, ctx.measureText(text).width);
      const grad = ctx.createLinearGradient(from.x, from.y, from.x + w, from.y);
      grad.addColorStop(0, rainbow(annotation.colorPhase));
      grad.addColorStop(
        1,
        rainbow(annotation.colorPhase + SHAPE_GRADIENT_SPAN),
      );
      ctx.fillStyle = grad;
    };

    if (!annotation.editing && g.content.length === 0) {
      // dragging preview: dashed frame + "TEXT" placeholder (size + colour)
      const to = sceneCoordsToViewportCoords(
        { sceneX: g.to.x, sceneY: g.to.y },
        state,
      );
      const x = Math.min(from.x, to.x);
      const y = Math.min(from.y, to.y);
      const w = Math.abs(to.x - from.x);
      const h = Math.abs(to.y - from.y);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = phaseColor();
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
      ctx.font = `${Math.max(16, Math.round(h))}px sans-serif`;
      ctx.textBaseline = "top";
      if (strategy.mode === "single") {
        ctx.fillStyle = strategy.color;
      } else {
        applyGradient("TEXT");
      }
      ctx.fillText("TEXT", x, y);
      return;
    }

    if (g.content.length === 0) {
      return;
    }
    ctx.font = `${g.fontSize}px sans-serif`;
    ctx.textBaseline = "top";
    if (strategy.mode === "single") {
      ctx.fillStyle = strategy.color;
    } else {
      applyGradient(g.content);
    }
    ctx.fillText(g.content, from.x, from.y);
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    annotation: PresentationAnnotation,
    state: AppState,
  ) {
    const geometry = annotation.geometry;
    let tip: Point;
    let tail: Point;
    if (geometry.kind === "line") {
      tip = sceneCoordsToViewportCoords(
        { sceneX: geometry.to.x, sceneY: geometry.to.y },
        state,
      );
      tail = sceneCoordsToViewportCoords(
        { sceneX: geometry.from.x, sceneY: geometry.from.y },
        state,
      );
    } else if (geometry.kind === "freehand") {
      const pts = geometry.laserPointer.originalPoints;
      if (pts.length < 2) {
        return;
      }
      // Direction from a point ~ARROW_DIR_DIST back along the trail, not the
      // noisy last-two-points segment — keeps the arrowhead angle stable.
      const last = pts[pts.length - 1];
      let acc = 0;
      let tailPt = pts[0];
      for (let i = pts.length - 1; i > 0; i--) {
        acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        tailPt = pts[i - 1];
        if (acc >= ARROW_DIR_DIST) {
          break;
        }
      }
      tip = sceneCoordsToViewportCoords(
        { sceneX: last[0], sceneY: last[1] },
        state,
      );
      tail = sceneCoordsToViewportCoords(
        { sceneX: tailPt[0], sceneY: tailPt[1] },
        state,
      );
    } else {
      return;
    }
    const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
    const size = state.presentationStrokeSize;
    const s = geometry.kind === "line" ? (size / 1.5) * 4 : size * 2.5;
    // Filled: apex sits ahead of the pen tip (lead = s/2). Open: apex IS the
    // pen tip (lead = 0) so the V's point meets the stroke end with no gap.
    const lead = state.presentationArrowStyle === "open" ? 0 : s * 0.5;
    const apex = {
      x: tip.x + Math.cos(angle) * lead,
      y: tip.y + Math.sin(angle) * lead,
    };
    const left = {
      x: apex.x - s * Math.cos(angle - Math.PI / 6),
      y: apex.y - s * Math.sin(angle - Math.PI / 6),
    };
    const right = {
      x: apex.x - s * Math.cos(angle + Math.PI / 6),
      y: apex.y - s * Math.sin(angle + Math.PI / 6),
    };
    const strategy = state.presentationColorStrategy;
    const color =
      strategy.mode === "single"
        ? strategy.color
        : rainbow(this.tipPhase(annotation));
    if (state.presentationArrowStyle === "open") {
      // Open V arrowhead: apex at the pen tip, two stroked lines sweeping back.
      ctx.strokeStyle = color;
      // Match the stroke width so the V wings and the trail are the same
      // thickness; with round caps their overlap reads as a continuous joint.
      ctx.lineWidth = geometry.kind === "freehand" ? size : size / 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y);
      ctx.lineTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}
