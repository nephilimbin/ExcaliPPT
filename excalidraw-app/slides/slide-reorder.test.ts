import { describe, it, expect } from "vitest";
import { newElement, newFrameElement } from "@excalidraw/element";

import { reorderFrames } from "./slide-reorder";

describe("reorderFrames", () => {
  // [rect, f1, ellipse, f2, line]
  const mk = () => [
    newElement({ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }),
    newFrameElement({ x: 0, y: 0, width: 1, height: 1, name: "f1" }),
    newElement({ type: "ellipse", x: 0, y: 0, width: 1, height: 1 }),
    newFrameElement({ x: 0, y: 0, width: 1, height: 1, name: "f2" }),
    newElement({ type: "diamond", x: 0, y: 0, width: 1, height: 1 }),
  ];

  const ids = (els: { id: string }[]) => els.map((e) => e.id);

  it("fromId === toId → 顺序不变", () => {
    const els = mk();
    expect(ids(reorderFrames(els, els[1].id, els[1].id))).toEqual(ids(els));
  });

  it("id 不存在 → 顺序不变", () => {
    const els = mk();
    expect(ids(reorderFrames(els, "nope", els[1].id))).toEqual(ids(els));
    expect(ids(reorderFrames(els, els[1].id, "nope"))).toEqual(ids(els));
  });

  it("后面的 frame 移到前面 frame 之前(f2 → f1 前),其它元素原位", () => {
    const els = mk();
    const out = reorderFrames(els, els[3].id, els[1].id);
    // [rect, f1, ellipse, f2, line] → [rect, f2, f1, ellipse, line]
    expect(ids(out)).toEqual([
      els[0].id,
      els[3].id,
      els[1].id,
      els[2].id,
      els[4].id,
    ]);
  });

  it("前面的 frame 移到后面 frame 之前(f1 → f2 前),中间元素原位", () => {
    const els = mk();
    const out = reorderFrames(els, els[1].id, els[3].id);
    // [rect, f1, ellipse, f2, line] → [rect, ellipse, f1, f2, line]
    expect(ids(out)).toEqual([
      els[0].id,
      els[2].id,
      els[1].id,
      els[3].id,
      els[4].id,
    ]);
  });

  it("元素集合不变(无丢失/新增)", () => {
    const els = mk();
    const out = reorderFrames(els, els[3].id, els[1].id);
    expect(new Set(ids(out))).toEqual(new Set(ids(els)));
    expect(out).toHaveLength(els.length);
  });

  it("不修改原数组(不可变)", () => {
    const els = mk();
    const before = ids(els);
    reorderFrames(els, els[3].id, els[1].id);
    expect(ids(els)).toEqual(before);
  });
});
