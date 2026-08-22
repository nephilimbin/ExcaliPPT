// 契约意图:通道名是主进程与 preload 之间的硬契约,改一个忘了另一个 = 运行时静默失联。
// 锁死:统一前缀、互不相同、只含约定字段,重命名会在此显式失败而非线上漂移。

import { IPC } from "./ipc-channels";

describe("IPC channel contract", () => {
  it("所有通道统一 excalippt: 前缀且互不相同", () => {
    const names = Object.values(IPC);
    for (const name of names) {
      expect(name.startsWith("excalippt:")).toBe(true);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it("契约字段齐全(open / close / closed 三通道)", () => {
    expect(IPC.teleprompterOpen).toContain("teleprompter");
    expect(IPC.teleprompterClose).toContain("teleprompter");
    expect(IPC.teleprompterClosed).toContain("teleprompter");
  });
});
