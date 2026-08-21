// 口播提词器滚屏引擎:纯 reducer,无 DOM。
// 状态机:idle → playing ↔ paused;playing 滚到 length → ended(不循环)。
// 所有函数纯:入参 state,返回新 state,不 mutate。

export type TeleprompterStatus = "idle" | "playing" | "paused" | "ended";

export interface TeleprompterState {
  status: TeleprompterStatus;
  /** 已滚动距离(px)。 */
  offset: number;
  /** 滚屏速率(px/s)。 */
  speed: number;
  /** 总可滚动距离(px)= 内容高 − 视口高,>= 0。 */
  length: number;
}

export const createTeleprompterEngine = (
  length: number,
  speed = 80,
): TeleprompterState => ({
  status: "idle",
  offset: 0,
  speed: Math.max(0, speed),
  length: Math.max(0, length),
});

/** 一帧推进:仅 playing 态按 speed×dt 滚;到 length 钳位并置 ended。 */
export const tick = (
  state: TeleprompterState,
  dtMs: number,
): TeleprompterState => {
  if (state.status !== "playing" || dtMs <= 0) {
    return state;
  }
  const next = state.offset + (state.speed * dtMs) / 1000;
  if (next >= state.length) {
    return { ...state, offset: state.length, status: "ended" };
  }
  return { ...state, offset: next };
};

export const play = (state: TeleprompterState): TeleprompterState => {
  if (state.length <= 0) {
    return state; // 无可滚内容
  }
  // ended → 从头重放
  if (state.status === "ended") {
    return { ...state, status: "playing", offset: 0 };
  }
  return { ...state, status: "playing" };
};

export const pause = (state: TeleprompterState): TeleprompterState => {
  if (state.status !== "playing") {
    return state;
  }
  return { ...state, status: "paused" };
};

export const togglePlay = (state: TeleprompterState): TeleprompterState =>
  state.status === "playing" ? pause(state) : play(state);

/** 跳转:钳到 [0, length];到末尾置 ended,离开末尾时 ended → paused。 */
export const seek = (
  state: TeleprompterState,
  offset: number,
): TeleprompterState => {
  const clamped = Math.max(0, Math.min(state.length, offset));
  let status = state.status;
  if (state.length > 0 && clamped >= state.length) {
    status = "ended";
  } else if (state.status === "ended") {
    status = "paused";
  }
  return { ...state, offset: clamped, status };
};

export const setSpeed = (
  state: TeleprompterState,
  speed: number,
): TeleprompterState => ({ ...state, speed: Math.max(0, speed) });

/** 内容/字号变化 → 重设 length,并把 offset 钳进新范围。 */
export const setLength = (
  state: TeleprompterState,
  length: number,
): TeleprompterState => {
  const len = Math.max(0, length);
  return { ...state, length: len, offset: Math.min(state.offset, len) };
};

/** 归一化进度 [0, 1];length 为 0 → 0。 */
export const getProgress = (state: TeleprompterState): number =>
  state.length > 0 ? state.offset / state.length : 0;
