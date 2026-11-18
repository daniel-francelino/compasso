import { addNoise, gaussianBlur, pixelate, unsharpMask } from "@/lib/shared/design/raster/filters";
import {
  DesignFilter,
  type FilterParams,
  filterHalo,
} from "@/lib/shared/design/raster/filter-types";
import { createSeededRandom } from "@/lib/shared/design/raster/numeric";
import {
  createPixelBuffer,
  type PixelBuffer,
  type Rect,
} from "@/lib/shared/design/raster/pixel-buffer";
import type { SelectionMask } from "@/lib/shared/design/raster/selection";

export const FILTER_TILE = 512;

export type FilterPlan = { crop: Rect; inner: Rect };

const intersect = (area: Rect, width: number, height: number): Rect | null => {
  const x0 = Math.max(0, Math.floor(area.x));
  const y0 = Math.max(0, Math.floor(area.y));
  const x1 = Math.min(width, Math.ceil(area.x + area.width));
  const y1 = Math.min(height, Math.ceil(area.y + area.height));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
};

const grow = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + 2 * by,
  height: rect.height + 2 * by,
});

export const planFilter = (
  width: number,
  height: number,
  region: Rect,
  params: FilterParams,
): FilterPlan | null => {
  const area = intersect(region, width, height);
  if (area === null) return null;
  const crop = intersect(grow(area, filterHalo(params)), width, height);
  if (crop === null) return null;
  return {
    crop,
    inner: { x: area.x - crop.x, y: area.y - crop.y, width: area.width, height: area.height },
  };
};

export const cropBuffer = (buffer: PixelBuffer, rect: Rect): PixelBuffer => {
  const out = createPixelBuffer(rect.width, rect.height);
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * buffer.width + rect.x) * 4;
    out.data.set(buffer.data.subarray(start, start + rect.width * 4), row * rect.width * 4);
  }
  return out;
};

const copyInto = (from: PixelBuffer, rect: Rect, to: PixelBuffer, x: number, y: number): void => {
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * from.width + rect.x) * 4;
    to.data.set(from.data.subarray(start, start + rect.width * 4), ((y + row) * to.width + x) * 4);
  }
};

const tiled = (
  crop: PixelBuffer,
  inner: Rect,
  halo: number,
  run: (tile: PixelBuffer) => PixelBuffer,
): PixelBuffer => {
  const out = createPixelBuffer(inner.width, inner.height);
  for (let ty = 0; ty < inner.height; ty += FILTER_TILE) {
    for (let tx = 0; tx < inner.width; tx += FILTER_TILE) {
      const core = {
        x: inner.x + tx,
        y: inner.y + ty,
        width: Math.min(FILTER_TILE, inner.width - tx),
        height: Math.min(FILTER_TILE, inner.height - ty),
      };
      const source = intersect(grow(core, halo), crop.width, crop.height);
      if (source === null) continue;
      const result = run(cropBuffer(crop, source));
      const local = {
        x: core.x - source.x,
        y: core.y - source.y,
        width: core.width,
        height: core.height,
      };
      copyInto(result, local, out, tx, ty);
    }
  }
  return out;
};

export const executeFilter = (
  crop: PixelBuffer,
  inner: Rect,
  params: FilterParams,
): PixelBuffer => {
  if (params.filter === DesignFilter.GaussianBlur) {
    return tiled(crop, inner, filterHalo(params), (tile) => gaussianBlur(tile, params.radius));
  }
  if (params.filter === DesignFilter.Sharpen) {
    return tiled(crop, inner, filterHalo(params), (tile) => unsharpMask(tile, params));
  }
  const area = cropBuffer(crop, inner);
  if (params.filter === DesignFilter.Noise) {
    return addNoise(area, params, createSeededRandom(params.seed));
  }
  return pixelate(area, params.cell);
};

export const blendFiltered = (
  target: PixelBuffer,
  original: PixelBuffer,
  filtered: PixelBuffer,
  region: Rect,
  mask: SelectionMask | null,
): void => {
  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      const index = (region.y + y) * target.width + region.x + x;
      const weight = mask === null ? 1 : (mask.data[index] ?? 0) / 255;
      const from = index * 4;
      const via = (y * region.width + x) * 4;
      for (let c = 0; c < 4; c += 1) {
        const before = original.data[from + c] ?? 0;
        const after = filtered.data[via + c] ?? 0;
        target.data[from + c] = before + (after - before) * weight;
      }
    }
  }
};

export const restoreRegion = (target: PixelBuffer, original: PixelBuffer, region: Rect): void =>
  copyInto(original, region, target, region.x, region.y);
