// 幻灯片创建工厂。纯函数:给定配置 + 定位点,产出 frame 元素。
// 单张(Issue 01)+ 批量创建 + 方向排列 + 命名(Issue 03)。

import { newFrameElement } from "@excalidraw/element";

import type { ExcalidrawFrameElement } from "@excalidraw/element/types";

import type { AspectPreset } from "./aspect-preset";

export interface Point {
  x: number;
  y: number;
}

/** 批量创建时幻灯片之间的固定间距(canvas 单位)。 */
export const DEFAULT_GAP = 100;

export interface CreateSlideOptions {
  preset: AspectPreset;
  /** frame 应居中的点(canvas 坐标,通常为视口中心) */
  center: Point;
  /** 命名序号(0-based),生成 "Slide {index+1}"。默认 0。 */
  index?: number;
}

/**
 * 创建单张幻灯片:frame 中心对齐 center,尺寸 = preset 分辨率。
 * Frame 内容尺寸 = 目标分辨率(所见即所得,见 ADR-0001)。
 */
export const createSlide = (
  opts: CreateSlideOptions,
): ExcalidrawFrameElement => {
  const { preset, center, index = 0 } = opts;
  return newFrameElement({
    x: center.x - preset.width / 2,
    y: center.y - preset.height / 2,
    width: preset.width,
    height: preset.height,
    name: `Slide ${index + 1}`,
  });
};

/** 幻灯片排列方向:水平(x 递增)或垂直(y 递增)。 */
export type SlideDirection = "horizontal" | "vertical";

/** 排列布局参数(供 slideCenterAt 计算每张中心)。 */
export interface SlideLayout {
  /** 第一张 frame 的中心(canvas)。 */
  start: Point;
  direction: SlideDirection;
  width: number;
  height: number;
  gap: number;
}

/**
 * 第 index 张(0-based)幻灯片的中心坐标(排列方向单一真源)。
 * - horizontal:x 按 width+gap 递增,y 对齐 start.y
 * - vertical:y 按 height+gap 递增,x 对齐 start.x
 */
export const slideCenterAt = (index: number, layout: SlideLayout): Point => {
  if (layout.direction === "vertical") {
    return {
      x: layout.start.x,
      y: layout.start.y + index * (layout.height + layout.gap),
    };
  }
  return {
    x: layout.start.x + index * (layout.width + layout.gap),
    y: layout.start.y,
  };
};

export interface CreateSlidesOptions {
  preset: AspectPreset;
  /** 第一张 frame 的中心(canvas 坐标,通常视口中心)。 */
  center: Point;
  /** 创建张数。 */
  count: number;
  /** 命名起始序号(0-based),生成 "Slide {startIndex+1}..。默认 0。 */
  startIndex?: number;
  /** 幻灯片间距(canvas 单位)。默认 DEFAULT_GAP。 */
  gap?: number;
  /** 排列方向。默认 horizontal。 */
  direction?: SlideDirection;
}

/**
 * 批量创建幻灯片:第一张中心在 `center`,其余按 `direction` 沿方向轴排开。
 * 相邻幻灯片之间留固定 `gap`(不粘连)。命名接续 startIndex。
 * count ≤ 0 返回空数组。
 */
export const createSlides = (
  opts: CreateSlidesOptions,
): ExcalidrawFrameElement[] => {
  const {
    preset,
    center,
    count,
    startIndex = 0,
    gap = DEFAULT_GAP,
    direction = "horizontal",
  } = opts;
  if (count <= 0) {
    return [];
  }
  return Array.from({ length: count }, (_, i) =>
    createSlide({
      preset,
      center: slideCenterAt(i, {
        start: center,
        direction,
        width: preset.width,
        height: preset.height,
        gap,
      }),
      index: startIndex + i,
    }),
  );
};
