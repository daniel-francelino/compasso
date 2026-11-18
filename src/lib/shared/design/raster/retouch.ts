import type { StrokeAccumulator, PixelShader } from "@/lib/shared/design/raster/brush";
import { ToneRange } from "@/lib/shared/design/raster/adjustment-types";
import { LUMA_BLUE, LUMA_GREEN, LUMA_RED, at, clamp01 } from "@/lib/shared/design/raster/numeric";
import { paintPixel } from "@/lib/shared/design/raster/pixel-paint";
import type { Point } from "@/lib/shared/design/raster/pixel-buffer";
import { TILE_SIZE, tileKey } from "@/lib/shared/design/raster/tiles";

export const ToneMode = { Dodge: "dodge", Burn: "burn" } as const;
export type ToneMode = (typeof ToneMode)[keyof typeof ToneMode];

export type ToneParams = { mode: ToneMode; range: ToneRange; exposure: number };

export const lumaOf = (r: number, g: number, b: number): number =>
  (LUMA_RED * r + LUMA_GREEN * g + LUMA_BLUE * b) / 255;

export const rangeWeight = (range: ToneRange, luma: number): number => {
  if (range === ToneRange.Shadows) return clamp01(1 - 2 * luma);
  if (range === ToneRange.Highlights) return clamp01(2 * luma - 1);
  return clamp01(1 - Math.abs(2 * luma - 1));
};

export const toneChannel = (value: number, mode: ToneMode, factor: number): number => {
  const amount = clamp01(factor);
  return mode === ToneMode.Dodge ? value + (255 - value) * amount : value * (1 - amount);
};

export const toneShader =
  (params: ToneParams): PixelShader =>
  (dst, di, base, bi, amount) => {
    const r = at(base, bi);
    const g = at(base, bi + 1);
    const b = at(base, bi + 2);
    const factor = clamp01(params.exposure) * amount * rangeWeight(params.range, lumaOf(r, g, b));
    dst[di] = toneChannel(r, params.mode, factor);
    dst[di + 1] = toneChannel(g, params.mode, factor);
    dst[di + 2] = toneChannel(b, params.mode, factor);
    dst[di + 3] = at(base, bi + 3);
  };

export const cloneOffset = (source: Point, start: Point): Point => ({
  x: Math.round(source.x - start.x),
  y: Math.round(source.y - start.y),
});

const sourceIndex = (
  stroke: StrokeAccumulator,
  x: number,
  y: number,
): { data: Uint8ClampedArray; index: number } | null => {
  const { buffer } = stroke;
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return null;
  const tile = stroke.before.get(tileKey(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE)));
  if (tile === undefined) return { data: buffer.data, index: (y * buffer.width + x) * 4 };
  return { data: tile.data, index: ((y - tile.y) * tile.width + (x - tile.x)) * 4 };
};

export const cloneShader =
  (stroke: StrokeAccumulator, offset: Point): PixelShader =>
  (dst, di, base, bi, amount, px, py) => {
    const source = sourceIndex(stroke, px + offset.x, py + offset.y);
    if (source === null) return;
    const alpha = at(source.data, source.index + 3) / 255;
    if (alpha <= 0) return;
    const color = {
      r: at(source.data, source.index),
      g: at(source.data, source.index + 1),
      b: at(source.data, source.index + 2),
    };
    paintPixel(dst, di, base, bi, color, amount * alpha, false);
  };
