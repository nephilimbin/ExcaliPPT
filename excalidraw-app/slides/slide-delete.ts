// 幻灯片删除:软删 frame + 解归其子元素。纯函数,可独立单测。
// 语义同 packages/excalidraw/actions/actionDeleteSelected.tsx(frame 删除时子元素留在画布)。

import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * 软删除指定 frame(`isDeleted: true`,保留给 undo/redo),
 * 并把归属它的子元素(`frameId === frameId`)解归(`frameId: null`,留在画布)。
 * 其它元素不变。返回新数组(不改原)。
 */
export const softDeleteFrame = (
  elements: readonly ExcalidrawElement[],
  frameId: string,
): ExcalidrawElement[] =>
  elements.map((el) => {
    if (el.id === frameId) {
      return newElementWith(el, { isDeleted: true });
    }
    if (el.frameId === frameId) {
      return newElementWith(el, { frameId: null });
    }
    return el;
  });
