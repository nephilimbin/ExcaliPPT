// 口播提词器视图:在独立弹窗(?teleprompter=1)中渲染。
// 提词态:黑底白字 + 固定红色读位线(视口中线)+ 当前行(穿过红线的行)灰底加粗高亮,
// 文案向上滚动,红线作"已读/未读"分界。编辑态:textarea 自动存 localStorage。
// 与画布正交(独立窗口),切 slide 不影响(见 ADR-0002)。
//
// 位置模型:引擎 offset 为像素;currentLine 在渲染时直接派生(与 offset/lineBoxes 同步,
// 无异步错位)。字号变化时,在渲染前(useLayoutEffect)同步"捕获旧阅读点比例 → 按新字号
// 重测 → 用新行高把同一阅读点对齐回红线",保持红线在当前行内的相对位置不变,且无抖动。

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import {
  createTeleprompterEngine,
  pause,
  seek as engineSeek,
  setLength,
  setSpeed,
  tick,
  togglePlay,
  type TeleprompterState,
} from "../teleprompter/teleprompter-engine";
import {
  DRAFT_KEY,
  loadDraft,
  loadSession,
  loadSettings,
  saveDraft,
  saveSession,
  updateSettings,
  type TeleprompterSettings,
} from "../teleprompter/teleprompter-storage";
import { canvasScopedKey } from "../app_constants";

import "./Teleprompter.scss";

type Mode = "edit" | "prompt";

interface LineBox {
  top: number;
  height: number;
}

/** 可"按住连续触发"的步进按钮:pointerDown 立即触发一次,长按 ~400ms 后自动重复。 */
const RepeatButton = ({
  onStep,
  className,
  title,
  children,
}: {
  onStep: () => void;
  className?: string;
  title?: string;
  children: ReactNode;
}) => {
  const timeoutRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<number | undefined>(undefined);

  const stop = useCallback(() => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (intervalRef.current !== undefined) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const start = () => {
    onStep();
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(onStep, 60);
    }, 400);
  };

  return (
    <button
      type="button"
      className={className}
      title={title}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
    >
      {children}
    </button>
  );
};

// ---- 窄工具栏图标:单色描边 SVG,内联自包含(提词器在独立 PiP window,不引外部图标库)----
// 宽模式显示文字,窄模式(@container max-width:480px)切换为这些图标,工具栏高度恒定。
const SVG_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  className: "teleprompter__svg",
} as const;

const STROKE_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PencilIcon = () => (
  <svg {...SVG_PROPS} {...STROKE_PROPS}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const MonitorIcon = () => (
  <svg {...SVG_PROPS} {...STROKE_PROPS}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

// 字号 − / +:字母 A 配减号 / 加号
const FontDecIcon = () => (
  <svg {...SVG_PROPS} {...STROKE_PROPS}>
    <path d="M5 18 9.5 6 14 18" />
    <path d="M7 13.5h5" />
    <path d="M17 15h4" />
  </svg>
);

const FontIncIcon = () => (
  <svg {...SVG_PROPS} {...STROKE_PROPS}>
    <path d="M5 18 9.5 6 14 18" />
    <path d="M7 13.5h5" />
    <path d="M17 15h4M19 13v4" />
  </svg>
);

const RewindIcon = () => (
  <svg {...SVG_PROPS} {...STROKE_PROPS}>
    <path d="M11 19 3 12 11 5Z" />
    <path d="M21 19V5l-8 7Z" />
  </svg>
);

const ForwardIcon = () => (
  <svg {...SVG_PROPS} {...STROKE_PROPS}>
    <path d="M13 19 21 12 13 5Z" />
    <path d="M3 19V5l8 7Z" />
  </svg>
);

// 镜像:中轴 + 左右实心三角指向轴(左右对称)
const MirrorIcon = () => (
  <svg {...SVG_PROPS} {...STROKE_PROPS}>
    <path d="M12 3v18" />
    <path d="M3 7 8 12 3 17Z" fill="currentColor" stroke="none" />
    <path d="M21 7 16 12 21 17Z" fill="currentColor" stroke="none" />
  </svg>
);

const PlayIcon = () => (
  <svg {...SVG_PROPS}>
    <path d="M6 4 20 12 6 20Z" fill="currentColor" />
  </svg>
);

const PauseIcon = () => (
  <svg {...SVG_PROPS}>
    <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
    <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
  </svg>
);

// 设置(齿轮):底栏纯图标按钮,点开/收起上方弹出面板
const GearIcon = () => (
  <svg {...SVG_PROPS} {...STROKE_PROPS}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// 黑白主题切换:半填充圆(对比)
const ContrastIcon = () => (
  <svg {...SVG_PROPS} {...STROKE_PROPS}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
  </svg>
);

/** 按钮内容:宽模式显示文字 label,窄模式(@container)切图标 icon。 */
const BtnBody = ({ label, icon }: { label: string; icon: ReactNode }) => (
  <>
    <span className="teleprompter__btn-icon" aria-hidden="true">
      {icon}
    </span>
    <span className="teleprompter__btn-label">{label}</span>
  </>
);

export const Teleprompter = ({
  bgOpacity = 1,
  variant = "pip",
  theme = "dark",
  onThemeChange,
}: {
  /** 背景不透明度 0–1(1=不透明);画布内模式由父传入,PiP 默认 1(不透明) */
  bgOpacity?: number;
  /** 渲染形态:pip=独立画中画窗口(全屏铺满该窗口);inline=主窗口内可拖动/缩放浮窗 */
  variant?: "pip" | "inline";
  /** 配色主题:dark=黑底白字;light=白底黑字 */
  theme?: "dark" | "light";
  /** 主题切换回调(面板内单按钮黑⇄白;真源在 SlidesPanel,经此回传) */
  onThemeChange?: (theme: "dark" | "light") => void;
}) => {
  const [text, setText] = useState<string>(loadDraft);
  const [settings, setSettings] = useState<TeleprompterSettings>(loadSettings);
  /** 工具栏弹出面板开关(其余按钮收进面板,点「设置」开/关)。 */
  const [panelOpen, setPanelOpen] = useState(false);
  const initialSession = useMemo(() => loadSession(), []);
  const [mode, setMode] = useState<Mode>(
    () => initialSession?.mode ?? "prompt",
  );
  const [engine, setEngine] = useState<TeleprompterState>(() =>
    createTeleprompterEngine(0, settings.speed),
  );

  const [redY, setRedY] = useState(0);
  const [lineBoxes, setLineBoxes] = useState<LineBox[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    line: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);
  const restoredOffsetRef = useRef(false);
  const sessionRef = useRef({ offset: 0, mode: "prompt" as Mode });
  const prevFontSizeRef = useRef(settings.fontSize);

  const lines = useMemo(() => text.split("\n"), [text]);

  /** 第 line 行(0 基)首字符在全文中的偏移(用于编辑态光标定位)。 */
  const lineStartChar = (line: number): number => {
    let n = 0;
    for (let i = 0; i < line && i < lines.length; i++) {
      n += lines[i].length + 1;
    }
    return n;
  };

  /** 某个滚动 offset 对应的行号(0 基)。 */
  const lineAtOffset = (offset: number): number => {
    if (lineBoxes.length === 0) {
      return 0;
    }
    const contentY = redY + offset;
    let idx = 0;
    for (let i = 0; i < lineBoxes.length; i++) {
      if (lineBoxes[i].top <= contentY) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  };

  /** 测量红线位置 + 各行几何 + 引擎可滚长度;返回新值供调用方同步使用。 */
  const doMeasure = useCallback(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) {
      return null;
    }
    const newRedY = Math.round(vp.clientHeight / 2);
    const boxes: LineBox[] = Array.from(
      ct.querySelectorAll<HTMLElement>(".teleprompter__line"),
      (el) => ({ top: el.offsetTop, height: el.offsetHeight }),
    );
    setRedY(newRedY);
    setLineBoxes(boxes);
    setEngine((e) =>
      setLength(e, Math.max(0, ct.scrollHeight - vp.clientHeight)),
    );
    return { redY: newRedY, boxes };
  }, []);

  // 渲染前同步:测量 + 字号变化保位(无抖动)。
  // 字号变化时:捕获旧"红线在当前行内的相对比例" → 按新字号重测 → 用新行高把同一阅读点对齐回红线。
  useLayoutEffect(() => {
    const fontChanged =
      prevFontSizeRef.current !== settings.fontSize && lineBoxes.length > 0;
    let keep: { line: number; frac: number } | null = null;
    if (fontChanged) {
      const contentY = redY + engine.offset;
      const line = lineAtOffset(engine.offset);
      const box = lineBoxes[line];
      if (box) {
        const frac = Math.max(
          0,
          Math.min(1, (contentY - box.top) / box.height),
        );
        keep = { line, frac };
      }
    }
    prevFontSizeRef.current = settings.fontSize;

    const m = doMeasure();
    if (keep && m) {
      const { line, frac } = keep;
      const box = m.boxes[Math.min(line, m.boxes.length - 1)];
      if (box) {
        setEngine((e) => engineSeek(e, box.top + frac * box.height - m.redY));
      }
    }
    // lineBoxes/redY/engine.offset/lineAtOffset 取本渲染闭包值(变化前旧值,用于捕获)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, settings.fontSize, mode, doMeasure]);

  useEffect(() => {
    const win = rootRef.current?.ownerDocument.defaultView ?? window;
    const onResize = () => doMeasure();
    win.addEventListener("resize", onResize);
    return () => win.removeEventListener("resize", onResize);
  }, [doMeasure]);

  // 画布内浮窗的拖拽缩放不触发 window resize → ResizeObserver 观察视口,尺寸一变即重测
  // (红线位置 redY=视口高一半 + 行几何 lineBoxes 必须与实际尺寸同步,否则红线与高亮行脱节)。
  // viewport 按模式条件渲染,编辑↔提词切换会换新 DOM 节点 → 依赖 mode 重挂观察游离旧节点
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || typeof ResizeObserver === "undefined") {
      return;
    }
    const ro = new ResizeObserver(() => doMeasure());
    ro.observe(vp);
    return () => ro.disconnect();
  }, [doMeasure, mode]);

  // 设置里的 speed 同步进引擎
  useEffect(() => {
    setEngine((e) => setSpeed(e, settings.speed));
  }, [settings.speed]);

  // rAF 滚屏(仅 playing);到末尾 tick 置 ended → 本 effect 重跑后停。
  useEffect(() => {
    if (engine.status !== "playing") {
      return;
    }
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      setEngine((e) => tick(e, dt));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine.status]);

  // 设置持久化:只写本组件管理的字段,merge 最新 storage ——
  // theme/bgTransparency/displayMode 挂载后还可能被 SlidesPanel 更新,
  // 整体回写旧快照会把它们覆盖回旧值(重开后丢失)
  useEffect(() => {
    updateSettings({
      speed: settings.speed,
      fontSize: settings.fontSize,
      editorFontSize: settings.editorFontSize,
      mirror: settings.mirror,
    });
  }, [settings]);

  // 同步外部清空(重置画布清口播稿):主窗口 removeItem → 本窗口(PiP)storage 事件 → 清空
  useEffect(() => {
    const win = rootRef.current?.ownerDocument.defaultView ?? window;
    const onStorage = (e: StorageEvent) => {
      if (e.key === canvasScopedKey(DRAFT_KEY)) {
        setText(e.newValue ?? "");
      }
    };
    win.addEventListener("storage", onStorage);
    return () => win.removeEventListener("storage", onStorage);
  }, []);

  // 恢复上次滚动位置:首次测量出各行几何后 seek 一次
  useEffect(() => {
    if (restoredOffsetRef.current || lineBoxes.length === 0) {
      return;
    }
    restoredOffsetRef.current = true;
    if (initialSession && initialSession.offset > 0) {
      setEngine((e) => engineSeek(e, initialSession.offset));
    }
  }, [lineBoxes, initialSession]);

  // 持久化会话(位置 + 模式);播放中不写,避免每帧写
  useEffect(() => {
    if (engine.status === "playing") {
      return;
    }
    saveSession({ offset: engine.offset, mode });
  }, [engine.offset, engine.status, mode]);

  // 维护最新会话快照(供 beforeunload 在播放中关闭时读取)
  useEffect(() => {
    sessionRef.current = { offset: engine.offset, mode };
  }, [engine.offset, mode]);

  // 窗口关闭 / 刷新前再存一次(挂在组件实际所在窗口,兼容画中画)
  useEffect(() => {
    const win = rootRef.current?.ownerDocument.defaultView ?? window;
    const onUnload = () => saveSession(sessionRef.current);
    win.addEventListener("beforeunload", onUnload);
    return () => win.removeEventListener("beforeunload", onUnload);
  }, []);

  // 切到编辑态:先暂停(若在播放),再把光标 + 滚动定位到"刚才念到的那一行"
  useEffect(() => {
    if (mode !== "edit") {
      return;
    }
    setEngine(pause);
    const ta = editorRef.current;
    if (!ta) {
      return;
    }
    const line = lineAtOffset(engine.offset);
    const char = lineStartChar(line);
    ta.focus();
    ta.setSelectionRange(char, char);
    const denom = Math.max(1, lines.length - 1);
    ta.scrollTop =
      (line / denom) * Math.max(0, ta.scrollHeight - ta.clientHeight);
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
    // 仅在进入编辑态触发;line/lines 取此刻闭包值,故不列入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 空格快捷键:非输入框内时切换播放/暂停(挂在组件实际所在窗口,兼容画中画)。
  // inline 形态共用主窗口:仅焦点在浮窗内才接管,不抢画布的按住 Space 平移
  useEffect(() => {
    const win = rootRef.current?.ownerDocument.defaultView ?? window;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") {
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") {
        return;
      }
      if (
        variant === "inline" &&
        !rootRef.current?.contains(e.target as Node | null)
      ) {
        return;
      }
      e.preventDefault();
      setEngine(togglePlay);
    };
    win.addEventListener("keydown", onKey);
    return () => win.removeEventListener("keydown", onKey);
  }, [variant]);

  // inline 浮窗打开即聚焦:空格快捷键立刻可用(无需先点一下浮窗)
  useEffect(() => {
    if (variant === "inline") {
      rootRef.current?.focus();
    }
  }, [variant]);

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    saveDraft(v);
  };
  /** 行号边栏与编辑区垂直滚动同步。 */
  const handleEditorScroll = () => {
    if (gutterRef.current && editorRef.current) {
      gutterRef.current.scrollTop = editorRef.current.scrollTop;
    }
  };
  const handleSeek = (e: ChangeEvent<HTMLInputElement>) =>
    setEngine((s) => engineSeek(s, Number(e.target.value)));
  /** 进度条悬停:跟随鼠标显示该位置对应的行号。 */
  const handleSeekMove = (e: MouseEvent<HTMLInputElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left) / rect.width),
    );
    setHoverInfo({
      x: e.clientX - rect.left,
      line: lineAtOffset(ratio * engine.length),
    });
  };
  const changeSpeed = (delta: number) =>
    setSettings((s) => ({ ...s, speed: Math.max(10, s.speed + delta) }));
  const changeFontSize = (delta: number) =>
    setSettings((s) =>
      mode === "edit"
        ? {
            ...s,
            editorFontSize: Math.max(1, s.editorFontSize + delta),
          }
        : { ...s, fontSize: Math.max(1, s.fontSize + delta) },
    );
  const toggleMirror = () => setSettings((s) => ({ ...s, mirror: !s.mirror }));

  // ---- 画布内浮窗:位置/大小(拖动与缩放实时改,pointerup 持久化进 settings) ----
  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), Math.max(min, max));

  const [inlineRect, setInlineRect] = useState(() => {
    // 按当前视口 clamp:存下的位置/大小可能超出本机视口(如大屏拖远后换小屏),
    // 落在视口外的浮窗拖不到也缩不到,且无 UI 入口重置
    const w = Math.min(settings.inlineW, window.innerWidth);
    const h = Math.min(settings.inlineH, window.innerHeight);
    return {
      x: clamp(settings.inlineX, 0, Math.max(0, window.innerWidth - w)),
      y: clamp(settings.inlineY, 0, Math.max(0, window.innerHeight - h)),
      w,
      h,
    };
  });
  const inlineRectRef = useRef(inlineRect);
  inlineRectRef.current = inlineRect;
  const dragRef = useRef<{
    px: number;
    py: number;
    ox: number;
    oy: number;
  } | null>(null);
  const resizeRef = useRef<{
    px: number;
    py: number;
    x: number;
    y: number;
    w: number;
    h: number;
    dir: string;
  } | null>(null);

  /** 工具栏拖动移动浮窗(按钮/输入框上按下不触发,避免误拖)。 */
  const handleDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (variant !== "inline") {
      return;
    }
    if (e.button !== 0) {
      return; // 仅左键拖动,右键/中键留给原生行为(上下文菜单等)
    }
    if (
      (e.target as HTMLElement).closest("button,input,.teleprompter__panel")
    ) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      px: e.clientX,
      py: e.clientY,
      ox: inlineRectRef.current.x,
      oy: inlineRectRef.current.y,
    };
  };
  const handleDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) {
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const r = inlineRectRef.current;
    setInlineRect({
      ...r,
      x: clamp(d.ox + e.clientX - d.px, 0, w - r.w),
      y: clamp(d.oy + e.clientY - d.py, 0, h - r.h),
    });
  };
  const handleDragEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return;
    }
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const r = inlineRectRef.current;
    updateSettings({ inlineX: r.x, inlineY: r.y });
  };

  /** 四边四角手柄拖动缩放(dir ∈ n/s/e/w/ne/nw/se/sw;最小 280×200,拖西/北边时位置联动)。 */
  const handleResizeStart = (
    e: ReactPointerEvent<HTMLDivElement>,
    dir: string,
  ) => {
    if (e.button !== 0) {
      return; // 仅左键缩放,与拖动一致
    }
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = inlineRectRef.current;
    resizeRef.current = {
      px: e.clientX,
      py: e.clientY,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      dir,
    };
  };
  const handleResizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = resizeRef.current;
    if (!d) {
      return;
    }
    // 最小值对齐浏览器 PiP 窗口的实际下限(实测 requestWindow({1,1}) 被 clamp 到
    // 240×52),两种形态缩到极限的行为一致;宽度 ≤480 时工具栏已切纯图标模式
    const MIN_W = 240;
    const MIN_H = 52;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    let { x, y, w, h } = d;
    if (d.dir.includes("e")) {
      w = clamp(d.w + dx, MIN_W, window.innerWidth - d.x);
    }
    if (d.dir.includes("s")) {
      h = clamp(d.h + dy, MIN_H, window.innerHeight - d.y);
    }
    if (d.dir.includes("w")) {
      // 西边:x 随指针走,w 反向补偿;clamp 保证不越过最小宽/视口左缘
      x = clamp(d.x + dx, 0, d.x + d.w - MIN_W);
      w = d.w + (d.x - x);
    }
    if (d.dir.includes("n")) {
      y = clamp(d.y + dy, 0, d.y + d.h - MIN_H);
      h = d.h + (d.y - y);
    }
    setInlineRect({ x, y, w, h });
  };
  const handleResizeEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) {
      return;
    }
    resizeRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const r = inlineRectRef.current;
    updateSettings({
      inlineX: r.x,
      inlineY: r.y,
      inlineW: r.w,
      inlineH: r.h,
    });
  };

  // 当前高亮行:渲染时直接派生(与 offset/lineBoxes 同步,无异步错位)
  const currentLine = lineBoxes.length ? lineAtOffset(engine.offset) : 0;
  const isPlaying = engine.status === "playing";

  // 背景色:按主题黑/白 + bgOpacity(不透明度)合成;画布内浮窗与 PiP 共用
  const bgColor =
    theme === "light"
      ? `rgba(255, 255, 255, ${bgOpacity})`
      : `rgba(15, 15, 16, ${bgOpacity})`;

  // 功能弹出面板:收纳全部功能按钮,点底栏「设置」齿轮开/关,锚定底栏上方(进度条上面)
  const panel = panelOpen && (
    <div className="teleprompter__panel">
      <button
        className="teleprompter__btn"
        title={mode === "edit" ? "提词" : "编辑"}
        onClick={() => setMode(mode === "edit" ? "prompt" : "edit")}
      >
        <BtnBody
          label={mode === "edit" ? "提词" : "编辑"}
          icon={mode === "edit" ? <MonitorIcon /> : <PencilIcon />}
        />
      </button>
      <RepeatButton
        className="teleprompter__btn"
        title="字号−"
        onStep={() => changeFontSize(-1)}
      >
        <BtnBody label="字号−" icon={<FontDecIcon />} />
      </RepeatButton>
      <RepeatButton
        className="teleprompter__btn"
        title="字号+"
        onStep={() => changeFontSize(1)}
      >
        <BtnBody label="字号+" icon={<FontIncIcon />} />
      </RepeatButton>
      {mode === "prompt" && (
        <>
          <RepeatButton
            className="teleprompter__btn"
            title="慢"
            onStep={() => changeSpeed(-10)}
          >
            <BtnBody label="慢" icon={<RewindIcon />} />
          </RepeatButton>
          <RepeatButton
            className="teleprompter__btn"
            title="快"
            onStep={() => changeSpeed(10)}
          >
            <BtnBody label="快" icon={<ForwardIcon />} />
          </RepeatButton>
          <button
            className="teleprompter__btn"
            title="镜像"
            aria-pressed={settings.mirror}
            onClick={toggleMirror}
          >
            <BtnBody label="镜像" icon={<MirrorIcon />} />
          </button>
        </>
      )}
      {onThemeChange && (
        <button
          className="teleprompter__btn"
          title={theme === "dark" ? "切白色主题" : "切黑色主题"}
          onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
        >
          <BtnBody
            label={theme === "dark" ? "白色" : "黑色"}
            icon={<ContrastIcon />}
          />
        </button>
      )}
    </div>
  );

  // 底栏「设置」齿轮按钮(纯图标、普通样式,开/关面板)
  const settingsBtn = (
    <button
      className="teleprompter__btn"
      title="设置"
      onClick={() => setPanelOpen((v) => !v)}
    >
      <GearIcon />
    </button>
  );

  return (
    <div
      className={`teleprompter${
        variant === "inline" ? " teleprompter--inline" : ""
      }${theme === "light" ? " teleprompter--light" : ""}`}
      ref={rootRef}
      // inline 浮窗根节点可聚焦(打开/点击即聚焦),空格快捷键的"焦点在浮窗内"
      // 判定才能成立;不可聚焦的 div 点击后焦点仍在 body,空格永远不触发
      tabIndex={variant === "inline" ? -1 : undefined}
      onPointerDownCapture={() => {
        if (variant === "inline") {
          rootRef.current?.focus();
        }
      }}
      style={
        {
          // 当前行底色 alpha 与背景透明度联动(scss .teleprompter__line--current 消费)
          "--tp-current-alpha": bgOpacity,
          ...(variant === "inline" && {
            left: inlineRect.x,
            top: inlineRect.y,
            width: inlineRect.w,
            height: inlineRect.h,
          }),
          backgroundColor: bgColor,
        } as CSSProperties
      }
    >
      {mode === "edit" ? (
        <>
          <div className="teleprompter__editor-wrap">
            <div
              className="teleprompter__gutter"
              ref={gutterRef}
              aria-hidden="true"
              style={{ fontSize: settings.editorFontSize }}
            >
              {lines.map((_, i) => (
                <div
                  key={i}
                  className={`teleprompter__gutter-line${
                    i === currentLine
                      ? " teleprompter__gutter-line--current"
                      : ""
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              ref={editorRef}
              className="teleprompter__editor"
              style={{ fontSize: settings.editorFontSize }}
              value={text}
              onChange={handleTextChange}
              onScroll={handleEditorScroll}
              placeholder="在此粘贴口播稿…"
              wrap="off"
              autoFocus
            />
          </div>
          <div
            className="teleprompter__bottom"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            {panel}
            {settingsBtn}
            <div className="teleprompter__readouts">
              <span className="teleprompter__readout">
                字 {settings.editorFontSize}
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="teleprompter__viewport" ref={viewportRef}>
            <div className="teleprompter__redline" style={{ top: redY }} />
            <div
              className="teleprompter__content"
              ref={contentRef}
              style={{
                fontSize: settings.fontSize,
                paddingTop: redY,
                paddingBottom: redY,
                transform: `translateY(${-engine.offset}px) scaleX(${
                  settings.mirror ? -1 : 1
                })`,
              }}
            >
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={`teleprompter__line${
                    i === currentLine ? " teleprompter__line--current" : ""
                  }`}
                >
                  {line || " "}
                </div>
              ))}
            </div>
          </div>
          <div
            className="teleprompter__bottom"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            {panel}
            <button
              className="teleprompter__btn"
              title={isPlaying ? "暂停" : "播放"}
              onClick={() => setEngine(isPlaying ? pause : togglePlay)}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="teleprompter__seek-wrap">
              <input
                ref={seekRef}
                className="teleprompter__seek"
                type="range"
                min={0}
                max={Math.max(1, engine.length)}
                value={engine.offset}
                onChange={handleSeek}
                onMouseMove={handleSeekMove}
                onMouseLeave={() => setHoverInfo(null)}
              />
              {hoverInfo && (
                <div
                  className="teleprompter__seek-tip"
                  style={{ left: hoverInfo.x }}
                >
                  第 {hoverInfo.line + 1} 行
                </div>
              )}
            </div>
            {settingsBtn}
            <span className="teleprompter__readout">速 {settings.speed}</span>
            <span className="teleprompter__readout">
              字 {settings.fontSize}
            </span>
            <span className="teleprompter__readout">
              {currentLine + 1}/{lines.length}行
            </span>
          </div>
        </>
      )}
      {variant === "inline" &&
        (["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map((dir) => (
          <div
            key={dir}
            className={`teleprompter__resize teleprompter__resize--${dir}`}
            onPointerDown={(e) => handleResizeStart(e, dir)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          />
        ))}
    </div>
  );
};
