import { describe, it, expect } from "vitest";
import { newElement, newFrameElement } from "@excalidraw/element";

import { getSlides } from "./slide-list";

describe("getSlides", () => {
  it("只返回 frame 元素,排除其他", () => {
    const frame = newFrameElement({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      name: "S1",
    });
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const slides = getSlides([rect, frame]);
    expect(slides).toHaveLength(1);
    expect(slides[0].type).toBe("frame");
  });

  it("无 frame 时返回空数组", () => {
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    expect(getSlides([rect])).toEqual([]);
  });

  it("保持 scene 顺序", () => {
    const f1 = newFrameElement({ x: 0, y: 0, width: 1, height: 1, name: "1" });
    const f2 = newFrameElement({ x: 0, y: 0, width: 1, height: 1, name: "2" });
    expect(getSlides([f1, f2]).map((s) => s.name)).toEqual(["1", "2"]);
  });
});
