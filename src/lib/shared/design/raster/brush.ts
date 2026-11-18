import { at, clamp01 } from "@/lib/shared/design/raster/numeric";
import { paintPixel } from "@/lib/shared/design/raster/pixel-paint";
import { recordStroke, type PixelPatch } from "@/lib/shared/design/raster/pixel-history";
import type { PixelBuffer, Point, Rect } from "@/lib/shared/design/raster/pixel-buffer";
import type { SelectionMask } from "@/lib/shared/design/raster/selection";
import { snapshotTile, tilesTouchedByRect, type TileData } from "@/lib/shared/design/raster/tiles";

export const MIN_DAB_SPACING_PX = 1;

export type BrushParams = {
  size: number;
  hardness: number;
  opacity: number;
  flow: number;
  color: { r: number; g: number; b: number };
  erase: boolean;
  selection?: SelectionMask | null;
  mask?: SelectionMask | null;
};

export type StrokeAccumulator = {
  buffer: PixelBuffer;
  before: Map<number, TileData>;
  coverage: Map<number, Float32Array>;
};

export type StrokeSegments = { dabs: Point[]; carry: number };

export const dabAlpha = (distance: number, radius: number, hardness: number): number => {
  const inner = radius * clamp01(hardness);
  const ramp = Math.max(radius - inner, 1);
  return clamp01((radius + 0.5 - distance) / ramp);
};

const limit = (mask: SelectionMask | null | undefined, index: number): number =>
  mask === null || mask === undefined ? 1 : at(mask.data, index) / 255;

const writePixel = (
  dst: Uint8ClampedArray,
  di: number,
  base: Uint8ClampedArray,
  bi: number,
  params: BrushParams,
  alpha: number,
): void => paintPixel(dst, di, base, bi, params.color, alpha, params.erase);

const dabBounds = (buffer: PixelBuffer, x: number, y: number, radius: number): Rect | null => {
  const reach = radius + 0.5;
  const x0 = Math.max(0, Math.floor(x - reach));
  const y0 = Math.max(0, Math.floor(y - reach));
  const x1 = Math.min(buffer.width, Math.ceil(x + reach));
  const y1 = Math.min(buffer.height, Math.ceil(y + reach));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
};

const dabStrength = (
  buffer: PixelBuffer,
  px: number,
  py: number,
  x: number,
  y: number,
  radius: number,
  params: BrushParams,
): number => {
  const falloff = dabAlpha(Math.hypot(px + 0.5 - x, py + 0.5 - y), radius, params.hardness);
  if (falloff <= 0) return 0;
  const index = py * buffer.width + px;
  return falloff * limit(params.selection, index) * limit(params.mask, index);
};

const stampDirect = (
  buffer: PixelBuffer,
  x: number,
  y: number,
  radius: number,
  bounds: Rect,
  params: BrushParams,
): void => {
  const gain = clamp01(params.flow) * clamp01(params.opacity);
  for (let py = bounds.y; py < bounds.y + bounds.height; py += 1) {
    for (let px = bounds.x; px < bounds.x + bounds.width; px += 1) {
      const strength = dabStrength(buffer, px, py, x, y, radius, params);
      if (strength <= 0) continue;
      const i = (py * buffer.width + px) * 4;
      writePixel(buffer.data, i, buffer.data, i, params, strength * gain);
    }
  }
};

export type PixelShader = (
  dst: Uint8ClampedArray,
  di: number,
  base: Uint8ClampedArray,
  bi: number,
  amount: number,
  px: number,
  py: number,
) => void;

export type DabStamp = (
  stroke: StrokeAccumulator,
  x: number,
  y: number,
  params: BrushParams,
) => void;

export const stampShaded = (
  stroke: StrokeAccumulator,
  x: number,
  y: number,
  params: BrushParams,
  shade: PixelShader,
): void => {
  const radius = params.size / 2;
  if (radius <= 0) return;
  const { buffer } = stroke;
  const bounds = dabBounds(buffer, x, y, radius);
  if (bounds === null) return;
  const flow = clamp01(params.flow);
  const opacity = clamp01(params.opacity);
  for (const { tx, ty } of tilesTouchedByRect(buffer.width, buffer.height, bounds)) {
    const tile = snapshotTile(buffer, stroke.before, tx, ty);
    const cover = stroke.coverage.get(tile.key) ?? new Float32Array(tile.width * tile.height);
    stroke.coverage.set(tile.key, cover);
    const y0 = Math.max(bounds.y, tile.y);
    const y1 = Math.min(bounds.y + bounds.height, tile.y + tile.height);
    const x0 = Math.max(bounds.x, tile.x);
    const x1 = Math.min(bounds.x + bounds.width, tile.x + tile.width);
    for (let py = y0; py < y1; py += 1) {
      for (let px = x0; px < x1; px += 1) {
        const strength = dabStrength(buffer, px, py, x, y, radius, params);
        if (strength <= 0) continue;
        const local = (py - tile.y) * tile.width + (px - tile.x);
        const accumulated = at(cover, local) + (1 - at(cover, local)) * strength * flow;
        cover[local] = accumulated;
        shade(
          buffer.data,
          (py * buffer.width + px) * 4,
          tile.data,
          local * 4,
          accumulated * opacity,
          px,
          py,
        );
      }
    }
  }
};

const paintShade =
  (params: BrushParams): PixelShader =>
  (dst, di, base, bi, amount) =>
    writePixel(dst, di, base, bi, params, amount);

export const stampDab = (
  buffer: PixelBuffer,
  x: number,
  y: number,
  params: BrushParams,
  stroke?: StrokeAccumulator,
): void => {
  const radius = params.size / 2;
  if (radius <= 0) return;
  if (stroke !== undefined) {
    stampShaded(stroke, x, y, params, paintShade(params));
    return;
  }
  const bounds = dabBounds(buffer, x, y, radius);
  if (bounds === null) return;
  stampDirect(buffer, x, y, radius, bounds, params);
};

export const dabSpacing = (size: number, spacingPercent: number): number =>
  Math.max(MIN_DAB_SPACING_PX, (size * spacingPercent) / 100);

export const strokeBetween = (
  points: readonly Point[],
  size: number,
  spacingPercent: number,
  carry?: number,
): StrokeSegments => {
  const spacing = dabSpacing(size, spacingPercent);
  const dabs: Point[] = [];
  let travelled = carry ?? spacing;
  const first = points[0];
  if (points.length === 1 && first !== undefined && carry === undefined) {
    return { dabs: [{ x: first.x, y: first.y }], carry: 0 };
  }
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    let position = 0;
    while (travelled + (length - position) >= spacing) {
      position += spacing - travelled;
      const t = position / length;
      dabs.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      travelled = 0;
    }
    travelled += length - position;
  }
  return { dabs, carry: travelled };
};

export const stabilize = (previous: Point, pointer: Point, radius: number): Point => {
  const dx = pointer.x - previous.x;
  const dy = pointer.y - previous.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius || distance === 0) return { x: previous.x, y: previous.y };
  const pull = (distance - radius) / distance;
  return { x: previous.x + dx * pull, y: previous.y + dy * pull };
};

export const beginStroke = (buffer: PixelBuffer): StrokeAccumulator => ({
  buffer,
  before: new Map(),
  coverage: new Map(),
});

export const paintStroke = (
  stroke: StrokeAccumulator,
  points: readonly Point[],
  params: BrushParams,
  spacingPercent: number,
  carry?: number,
  stamp?: DabStamp,
): number => {
  const segments = strokeBetween(points, params.size, spacingPercent, carry);
  for (const dab of segments.dabs) {
    if (stamp === undefined) stampDab(stroke.buffer, dab.x, dab.y, params, stroke);
    else stamp(stroke, dab.x, dab.y, params);
  }
  return segments.carry;
};

export const strokeTiles = (stroke: StrokeAccumulator): number[] => [...stroke.before.keys()];

export const finishStroke = (stroke: StrokeAccumulator): PixelPatch =>
  recordStroke(stroke.before, stroke.buffer);
