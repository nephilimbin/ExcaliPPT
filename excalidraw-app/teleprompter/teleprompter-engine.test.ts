import { describe, it, expect } from "vitest";

import {
  createTeleprompterEngine,
  getProgress,
  pause,
  play,
  seek,
  setLength,
  setSpeed,
  tick,
  togglePlay,
  type TeleprompterState,
} from "./teleprompter-engine";

describe("teleprompter-engine", () => {
  it("tick 按 speed×dt 推进 offset", () => {
    const s = play(createTeleprompterEngine(1000, 100)); // 100px/s
    const s2 = tick(s, 100); // 100ms → 10px
    expect(s2.offset).toBe(10);
    expect(s2.status).toBe("playing");
  });

  it("tick 到 length 钳位并置 ended(不超滚、不循环)", () => {
    const s = play(createTeleprompterEngine(100, 1000)); // 1000px/s
    const s2 = tick(s, 1000); // → 1000px >= length(100)
    expect(s2.offset).toBe(100);
    expect(s2.status).toBe("ended");
  });

  it("非 playing 态 tick 不变(idle/paused/ended)", () => {
    const idle = createTeleprompterEngine(1000, 100);
    expect(tick(idle, 100)).toBe(idle);
    const paused: TeleprompterState = {
      status: "paused",
      offset: 50,
      speed: 100,
      length: 1000,
    };
    expect(tick(paused, 100)).toBe(paused);
  });

  it("dt<=0 时 tick 不变", () => {
    const s = play(createTeleprompterEngine(1000, 100));
    expect(tick(s, 0)).toBe(s);
    expect(tick(s, -5)).toBe(s);
  });

  it("play/pause 保留 offset(恢复从原位继续)", () => {
    let s = play(createTeleprompterEngine(1000, 100));
    s = tick(s, 500); // offset 50
    s = pause(s);
    expect(s.status).toBe("paused");
    expect(s.offset).toBe(50);
    s = play(s);
    expect(s.status).toBe("playing");
    expect(s.offset).toBe(50);
  });

  it("play 自 ended 从头重放(offset 归 0)", () => {
    const ended: TeleprompterState = {
      status: "ended",
      offset: 100,
      speed: 10,
      length: 100,
    };
    const s = play(ended);
    expect(s.status).toBe("playing");
    expect(s.offset).toBe(0);
  });

  it("length<=0 时 play 无效", () => {
    const s = createTeleprompterEngine(0, 10);
    expect(play(s)).toBe(s);
  });

  it("togglePlay 在 playing↔paused 间切换", () => {
    const playing = play(createTeleprompterEngine(1000, 10));
    expect(togglePlay(playing).status).toBe("paused");
    expect(togglePlay(togglePlay(playing)).status).toBe("playing");
  });

  it("seek 钳到 [0, length]", () => {
    const s = createTeleprompterEngine(100, 10);
    expect(seek(s, -5).offset).toBe(0);
    expect(seek(s, 999).offset).toBe(100);
  });

  it("seek 跳离末尾 → ended 回到 paused", () => {
    const ended: TeleprompterState = {
      status: "ended",
      offset: 100,
      speed: 10,
      length: 100,
    };
    const s = seek(ended, 30);
    expect(s.status).toBe("paused");
    expect(s.offset).toBe(30);
  });

  it("seek 到末尾 → ended", () => {
    const s = createTeleprompterEngine(100, 10);
    expect(seek(s, 100).status).toBe("ended");
  });

  it("setSpeed 生效且非负", () => {
    const s = setSpeed(createTeleprompterEngine(100, 10), 200);
    expect(s.speed).toBe(200);
    expect(setSpeed(s, -5).speed).toBe(0);
  });

  it("setLength 重设并把 offset 钳进新范围", () => {
    let s = play(createTeleprompterEngine(1000, 10));
    s = tick(s, 500); // offset 5
    s = setLength(s, 3); // 缩短
    expect(s.length).toBe(3);
    expect(s.offset).toBe(3);
  });

  it("getProgress = offset/length(length 0 → 0)", () => {
    expect(getProgress(createTeleprompterEngine(0, 10))).toBe(0);
    const s = seek(createTeleprompterEngine(100, 10), 50);
    expect(getProgress(s)).toBe(0.5);
  });
});
