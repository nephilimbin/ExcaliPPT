import React from "react";

import { t } from "../i18n";

import { Island } from "./Island";

import type { AppState } from "../types";

import type {
  ColorStrategy,
  PresentationArrowStyle,
} from "../presentation/types";

type Props = {
  appState: Pick<
    AppState,
    | "currentPresentationKind"
    | "lastPresentationShape"
    | "presentationArrowStyle"
    | "presentationDecayMs"
    | "presentationStrokeSize"
    | "presentationColorStrategy"
    | "activeTool"
  >;
  setAppState: React.Component<any, AppState>["setState"];
};

// 主列种类:「图形」是 UI 入口(点击恢复 lastPresentationShape),非持久 kind。
const KINDS = [
  { value: "freehand", labelKey: "labels.presentationKindPen" },
  { value: "line", labelKey: "labels.presentationKindLine" },
  { value: "shape", labelKey: "labels.presentationKindShape" },
  { value: "text", labelKey: "labels.presentationKindText" },
] as const;

// 「图形」子形状行(照搬 ARROW_STYLES 模式):value 既是持久 kind,也是 lastPresentationShape。
const SHAPE_KINDS = [
  { value: "rectangle", labelKey: "labels.presentationKindRectangle" },
  { value: "ellipse", labelKey: "labels.presentationKindEllipse" },
  { value: "triangle", labelKey: "labels.presentationKindTriangle" },
] as const;

// Fade values are universal (digits + ∞), no translation needed.
const DECAY_OPTIONS = [
  { value: 1000, label: "1s" },
  { value: 2000, label: "2s" },
  { value: 5000, label: "5s" },
  { value: 0, label: "∞" },
];

const ARROW_STYLES = [
  { value: "none", labelKey: "labels.presentationArrowNone" },
  { value: "filled", labelKey: "labels.presentationArrowFilled" },
  { value: "open", labelKey: "labels.presentationArrowOpen" },
] as const;

/** Shape glyph for the [矩][椭][▲] picker (mirrors ArrowIcon). */
const ShapeIcon = ({
  kind,
}: {
  kind: "rectangle" | "ellipse" | "triangle";
}) => {
  const svgProps = {
    width: 22,
    height: 14,
    viewBox: "0 0 22 14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "rectangle") {
    return (
      <svg {...svgProps}>
        <rect x={3} y={2} width={16} height={10} rx={1} />
      </svg>
    );
  }
  if (kind === "ellipse") {
    return (
      <svg {...svgProps}>
        <ellipse cx={11} cy={7} rx={8} ry={5} />
      </svg>
    );
  }
  return (
    <svg {...svgProps}>
      <polygon points="11,2 20,12 2,12" />
    </svg>
  );
};

/** Arrowhead glyph for the arrow-style picker. Icons (not a <select>) so the
 * control's width is fixed and unaffected by translated option labels. */
const ArrowIcon = ({ style }: { style: PresentationArrowStyle }) => {
  const svgProps = {
    width: 22,
    height: 14,
    viewBox: "0 0 22 14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (style === "none") {
    return (
      <svg {...svgProps}>
        <line x1={3} y1={7} x2={19} y2={7} />
      </svg>
    );
  }
  if (style === "filled") {
    return (
      <svg {...svgProps}>
        <line x1={3} y1={7} x2={14} y2={7} />
        <polygon points="14,2 19,7 14,12" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...svgProps}>
      <line x1={3} y1={7} x2={14} y2={7} />
      <polyline points="14,2 19,7 14,12" />
    </svg>
  );
};

/**
 * Floating settings panel shown while the laser (presentation annotation) tool
 * is active. Two-column rows: label on the left, control on the right. All
 * visible text goes through i18n. State is persisted via `setAppState` (the
 * relevant AppState keys are flagged `browser: true`).
 */
export const PresentationSettings = ({ appState, setAppState }: Props) => {
  const color = appState.presentationColorStrategy;
  const canArrow =
    appState.currentPresentationKind === "line" ||
    appState.currentPresentationKind === "freehand";
  const canShape =
    appState.currentPresentationKind === "rectangle" ||
    appState.currentPresentationKind === "ellipse" ||
    appState.currentPresentationKind === "triangle";

  return (
    <Island padding={3}>
      <div style={gridStyle} data-testid="presentation-settings">
        <span style={labelStyle}>{t("labels.presentationTool")}</span>
        <div style={toolColStyle}>
          {KINDS.map((k) => {
            if (k.value === "shape") {
              // 图形入口:恢复上次子形状;高亮当当前落在图形组
              return (
                <button
                  key="shape"
                  data-testid="presentation-kind-shape"
                  onClick={() =>
                    setAppState({
                      currentPresentationKind: appState.lastPresentationShape,
                    })
                  }
                  style={btnStyle(canShape)}
                >
                  {t(k.labelKey)}
                </button>
              );
            }
            return (
              <button
                key={k.value}
                data-testid={`presentation-kind-${k.value}`}
                onClick={() =>
                  setAppState({ currentPresentationKind: k.value })
                }
                style={btnStyle(appState.currentPresentationKind === k.value)}
              >
                {t(k.labelKey)}
              </button>
            );
          })}
        </div>

        <span style={labelStyle}>{t("labels.presentationSize")}</span>
        <input
          type="number"
          min={1}
          max={50}
          step={1}
          value={appState.presentationStrokeSize}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            if (Number.isFinite(n)) {
              setAppState({
                presentationStrokeSize: Math.min(50, Math.max(1, n)),
              });
            }
          }}
          style={inputStyle}
        />

        {canArrow && (
          <>
            <span style={labelStyle}>{t("labels.presentationArrow")}</span>
            <div style={arrowRowStyle}>
              {ARROW_STYLES.map((a) => (
                <button
                  key={a.value}
                  title={t(a.labelKey)}
                  aria-label={t(a.labelKey)}
                  onClick={() =>
                    setAppState({ presentationArrowStyle: a.value })
                  }
                  style={arrowBtnStyle(
                    appState.presentationArrowStyle === a.value,
                  )}
                >
                  <ArrowIcon style={a.value} />
                </button>
              ))}
            </div>
          </>
        )}

        {canShape && (
          <>
            <span style={labelStyle}>{t("labels.presentationShape")}</span>
            <div style={arrowRowStyle}>
              {SHAPE_KINDS.map((s) => (
                <button
                  key={s.value}
                  data-testid={`presentation-shape-${s.value}`}
                  title={t(s.labelKey)}
                  aria-label={t(s.labelKey)}
                  onClick={() =>
                    setAppState({
                      currentPresentationKind: s.value,
                      lastPresentationShape: s.value,
                    })
                  }
                  style={arrowBtnStyle(
                    appState.currentPresentationKind === s.value,
                  )}
                >
                  <ShapeIcon kind={s.value} />
                </button>
              ))}
            </div>
          </>
        )}

        <span style={labelStyle}>{t("labels.presentationFade")}</span>
        <select
          value={appState.presentationDecayMs}
          onChange={(e) =>
            setAppState({ presentationDecayMs: Number(e.target.value) })
          }
          style={selectStyle}
        >
          {DECAY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <span style={labelStyle}>{t("labels.presentationColor")}</span>
        {color.mode === "single" ? (
          <input
            type="color"
            value={color.color}
            onChange={(e) =>
              setAppState({
                presentationColorStrategy: {
                  mode: "single",
                  color: e.target.value,
                },
              })
            }
            style={swatchBoxStyle}
          />
        ) : (
          <span style={rainbowSwatchStyle} />
        )}

        <span style={labelStyle}>{t("labels.presentationRainbow")}</span>
        <button
          onClick={() =>
            setAppState({
              presentationColorStrategy: toggleColorStrategy(color),
            })
          }
          style={btnStyle(false)}
        >
          {color.mode === "single"
            ? t("labels.presentationColorOff")
            : t("labels.presentationColorOn")}
        </button>
      </div>
    </Island>
  );
};

const toggleColorStrategy = (color: ColorStrategy): ColorStrategy =>
  color.mode === "single"
    ? { mode: "gradient" }
    : { mode: "single", color: "#ff0000" };

const btnStyle = (active: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "4px 6px",
  whiteSpace: "nowrap",
  borderRadius: 5,
  border: "1px solid var(--button-border, #ccc)",
  background: active
    ? "var(--button-special-active-bg, #6455ff)"
    : "transparent",
  color: active ? "var(--text-white, #fff)" : "inherit",
  cursor: "pointer",
});

// Two columns: label (auto-sized to the widest label) | control (fills rest).
// width: max-content so the panel grows to fit the longest translated label
// (e.g. German "Rechteck") instead of wrapping or overflowing.
// Fixed control-column width so the track never grows with a rendered control
// (e.g. the arrow <select> when pen/line is active) — tool buttons (width:100%)
// then stay a constant width regardless of selected kind or locale text length.
const CONTROL_COLUMN_WIDTH = 50;
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: `auto ${CONTROL_COLUMN_WIDTH}px`,
  gap: "8px 10px",
  alignItems: "center",
  width: "max-content",
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  opacity: 0.6,
};

const toolColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  // Keep the tool column wide enough to dominate the grid's control track even
  // when the arrow <select> row is absent (non-pen/line kinds). Without this,
  // removing that row lets the track shrink and the tool buttons (width:100%)
  // jitter between kinds.
  minWidth: 50,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--button-border, #ccc)",
  borderRadius: 5,
  padding: "4px 6px",
  // Match the tool buttons' height so every control in the panel aligns.
  height: 29,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--button-border, #ccc)",
  borderRadius: 5,
  padding: "4px 6px",
  height: 29,
};

const arrowRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  width: "100%",
};

const arrowBtnStyle = (active: boolean): React.CSSProperties => ({
  ...btnStyle(active),
  width: "auto",
  flex: 1,
  minWidth: 0,
  height: 29,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
});

const swatchBoxStyle: React.CSSProperties = {
  width: 28,
  height: 24,
  padding: 0,
  border: "1px solid var(--button-border, #ccc)",
  borderRadius: 4,
  background: "transparent",
  cursor: "pointer",
};

const rainbowSwatchStyle: React.CSSProperties = {
  width: 28,
  height: 24,
  borderRadius: 4,
  border: "1px solid var(--button-border, #ccc)",
  background:
    "linear-gradient(90deg,#ff0000,#ff9900,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff)",
};
