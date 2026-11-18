import {
  bucketRegion,
  fillSelection,
  linearGradient,
  radialGradient,
} from "@/lib/shared/design/raster/fill";
import { blendOnto } from "@/lib/shared/design/raster/blend";
import { clamp01 } from "@/lib/shared/design/raster/numeric";
import { recordStroke, type PixelPatch } from "@/lib/shared/design/raster/pixel-history";
import {
  createPixelBuffer,
  type PixelBuffer,
  type Point,
  type RgbaColor,
} from "@/lib/shared/design/raster/pixel-buffer";
import { maskBoundingBox, type SelectionMask } from "@/lib/shared/design/raster/selection";
import { snapshotRect, type TileData } from "@/lib/shared/design/raster/tiles";
import { DesignBlendMode } from "@/lib/shared/design/types";

export type FillBlend = { opacity: number; blendMode: DesignBlendMode };

export type GradientShape =
  { kind: "linear"; from: Point; to: Point } | { kind: "radial"; center: Point; radius: number };

const withOpacity = (color: RgbaColor, opacity: number): RgbaColor => ({
  ...color,
  a: color.a * clamp01(opacity),
});

const commit = (
  buffer: PixelBuffer,
  area: { x: number; y: number; width: number; height: number } | null,
  paint: () => void,
): PixelPatch | null => {
  if (area === null) return null;
  const before = new Map<number, TileData>();
  snapshotRect(buffer, before, area);
  paint();
  const patch = recordStroke(before, buffer);
  return patch.tiles.length === 0 ? null : patch;
};

const composite = (
  buffer: PixelBuffer,
  source: PixelBuffer,
  blend: FillBlend,
  coverage: SelectionMask | null,
): void =>
  blendOnto(buffer, source, {
    mode: blend.blendMode,
    opacity: 1,
    fillOpacity: 1,
    mask: coverage,
  });

export const bucketPatch = (
  buffer: PixelBuffer,
  x: number,
  y: number,
  color: RgbaColor,
  options: { tolerance: number; contiguous: boolean; selection?: SelectionMask | null } & FillBlend,
): PixelPatch | null => {
  const region = bucketRegion(buffer, x, y, options);
  const tinted = withOpacity(color, options.opacity);
  return commit(buffer, maskBoundingBox(region), () => {
    if (options.blendMode === DesignBlendMode.Normal) {
      fillSelection(buffer, tinted, region);
      return;
    }
    composite(buffer, createPixelBuffer(buffer.width, buffer.height, tinted), options, region);
  });
};

export const gradientPatch = (
  buffer: PixelBuffer,
  shape: GradientShape,
  start: RgbaColor,
  end: RgbaColor,
  blend: FillBlend,
  selection?: SelectionMask | null,
): PixelPatch | null => {
  const area =
    selection === null || selection === undefined
      ? { x: 0, y: 0, width: buffer.width, height: buffer.height }
      : maskBoundingBox(selection);
  return commit(buffer, area, () => {
    const from = withOpacity(start, blend.opacity);
    const to = withOpacity(end, blend.opacity);
    const target =
      blend.blendMode === DesignBlendMode.Normal
        ? buffer
        : createPixelBuffer(buffer.width, buffer.height);
    const limit = blend.blendMode === DesignBlendMode.Normal ? selection : null;
    if (shape.kind === "linear") linearGradient(target, shape.from, shape.to, from, to, limit);
    else radialGradient(target, shape.center, shape.radius, from, to, limit);
    if (target !== buffer) composite(buffer, target, blend, selection ?? null);
  });
};
