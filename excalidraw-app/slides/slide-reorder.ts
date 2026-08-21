// 幻灯片拖拽换序:在 scene elements 中移动 frame 顺序并重算 fractional index。
// 纯函数,可独立单测。详见 CONTEXT.md / ADR-0001。

import { arrayToMap } from "@excalidraw/common";
import { syncMovedIndices } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * 把 `fromId` 的 frame 移到 `toId` 的位置(插到 toId 之前),仅移动该 frame 本身,
 * 其它元素原位保留。重排后用 `syncMovedIndices` 重算被移动 frame 的 fractional index
 * (只动被移动元素,不误伤邻居 —— 见 packages/element/src/zindex.ts 的统一写法)。
 *
 * 边界:fromId === toId、或任一 id 不存在 → 返回原序副本(不变)。
 */
export const reorderFrames = (
  elements: readonly ExcalidrawElement[],
  fromId: string,
  toId: string,
): ExcalidrawElement[] => {
  if (fromId === toId) {
    return [...elements];
  }
  const fromIdx = elements.findIndex((e) => e.id === fromId);
  const toIdx = elements.findIndex((e) => e.id === toId);
  if (fromIdx === -1 || toIdx === -1) {
    return [...elements];
  }
  const next = [...elements];
  const [moved] = next.splice(fromIdx, 1);
  // splice 移除后,toIdx 指向的元素可能前移一位
  const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
  next.splice(insertIdx, 0, moved);
  syncMovedIndices(next, arrayToMap([moved]));
  return next;
};
