import "./ExcalidrawLogo.scss";

// 品牌标识为生成图(ExcaliPPT),替换原 Excalidraw 手绘 SVG;
// 通过 /public 静态路径引用,尺寸沿用 ExcalidrawLogo.scss 的 height 控制
const LogoIcon = () => (
  <img
    src="/excalippt-icon.png"
    alt=""
    draggable={false}
    className="ExcalidrawLogo-icon"
  />
);

const LogoText = () => (
  <img
    src="/excalippt-wordmark.png"
    alt="ExcaliPPT"
    draggable={false}
    className="ExcalidrawLogo-text"
  />
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom" | "mobile";

interface LogoProps {
  size?: LogoSize;
  withText?: boolean;
  style?: React.CSSProperties;
  /**
   * If true, the logo will not be wrapped in a Link component.
   * The link prop will be ignored as well.
   * It will merely be a plain div.
   */
  isNotLink?: boolean;
}

export const ExcalidrawLogo = ({
  style,
  size = "small",
  withText,
}: LogoProps) => {
  return (
    <div className={`ExcalidrawLogo is-${size}`} style={style}>
      <LogoIcon />
      {withText && <LogoText />}
    </div>
  );
};
