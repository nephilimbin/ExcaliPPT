// 幻灯片列表:从 scene 元素中提取所有 frame(Slide ≡ Frame)。
// 纯函数,保持 scene 顺序。

import { isFrameElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
} from "@excalidraw/element/types";

/** 从 scene 元素中提取所有幻灯片(非删除的 frame),保持 scene 顺序。 */
export const getSlides = (
  elements: readonly ExcalidrawElement[],
): ExcalidrawFrameElement[] =>
  elements.filter(
    (el) => isFrameElement(el) && !el.isDeleted,
  ) as ExcalidrawFrameElement[];
