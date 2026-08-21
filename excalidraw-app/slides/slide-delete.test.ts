import { describe, it, expect } from "vitest";
import {
  newElement,
  newElementWith,
  newFrameElement,
} from "@excalidraw/element";

import { softDeleteFrame } from "./slide-delete";

describe("softDeleteFrame", () => {
  it("软删 frame(isDeleted:true),子元素解归(frameId:null)", () => {
    const frame = newFrameElement({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      name: "f",
    });
    const child = newElementWith(
      newElement({ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }),
      { frameId: frame.id },
    );
    const other = newElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
    const out = softDeleteFrame([frame, child, other], frame.id);
    expect(out[0].isDeleted).toBe(true);
    expect(out[1].frameId).toBeNull();
    expect(out[2].isDeleted).toBe(false);
  });

  it("归属其它 frame 的子元素不被解归", () => {
    const frame = newFrameElement({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      name: "f",
    });
    const otherChild = newElementWith(
      newElement({ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }),
      { frameId: "other-frame" },
    );
    const out = softDeleteFrame([frame, otherChild], frame.id);
    expect(out[1].frameId).toBe("other-frame");
  });

  it("不存在的 frameId → 所有元素不变", () => {
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
    const out = softDeleteFrame([rect], "nope");
    expect(out[0].isDeleted).toBe(false);
  });

  it("不修改原数组(不可变)", () => {
    const frame = newFrameElement({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      name: "f",
    });
    softDeleteFrame([frame], frame.id);
    expect(frame.isDeleted).toBe(false);
  });
});
