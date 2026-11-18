import { at, clamp01 } from "@/lib/shared/design/raster/numeric";
import { paintPixel } from "@/lib/shared/design/raster/pixel-paint";
import {
  inBounds,
  type PixelBuffer,
  type Point,
  type RgbaColor,
} from "@/lib/shared/design/raster/pixel-buffer";
import {
  SelectionCombine,
  combineMasks,
  magicWand,
  type SelectionMask,
  type WandOptions,
} from "@/lib/shared/design/raster/selection";
import type { ValueOf } from "@/lib/shared/utils";

export const SampleSize = { Single: 1, Three: 3, Five: 5 } as const;
export type SampleSize = ValueOf<typeof SampleSize>;

export type BucketOptions = WandOptions & {
  selection?: SelectionMask | null;
  sample?: PixelBuffer | null;
};

const coverageOf = (selection: SelectionMask | null | undefined, index: number): number =>
  selection === null || selection === undefined ? 1 : at(selection.data, index) / 255;

export const fillSelection = (
  buffer: PixelBuffer,
  color: RgbaColor,
  selection?: SelectionMask | null,
): void => {
  const gain = color.a / 255;
  for (let p = 0; p < buffer.width * buffer.height; p += 1) {
    const alpha = gain * coverageOf(selection, p);
    if (alpha <= 0) continue;
    paintPixel(buffer.data, p * 4, buffer.data, p * 4, color, alpha, false);
  }
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const paintGradient = (
  buffer: PixelBuffer,
  start: RgbaColor,
  end: RgbaColor,
  selection: SelectionMask | null | undefined,
  position: (x: number, y: number) => number,
): void => {
  const color = { r: 0, g: 0, b: 0 };
  for (let y = 0; y < buffer.height; y += 1) {
    for (let x = 0; x < buffer.width; x += 1) {
      const p = y * buffer.width + x;
      const coverage = coverageOf(selection, p);
      if (coverage <= 0) continue;
      const t = clamp01(position(x + 0.5, y + 0.5));
      color.r = lerp(start.r, end.r, t);
      color.g = lerp(start.g, end.g, t);
      color.b = lerp(start.b, end.b, t);
      const alpha = (lerp(start.a, end.a, t) / 255) * coverage;
      if (alpha <= 0) continue;
      paintPixel(buffer.data, p * 4, buffer.data, p * 4, color, alpha, false);
    }
  }
};

export const linearGradient = (
  buffer: PixelBuffer,
  from: Point,
  to: Point,
  start: RgbaColor,
  end: RgbaColor,
  selection?: SelectionMask | null,
): void => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  paintGradient(buffer, start, end, selection, (x, y) =>
    lengthSquared === 0 ? 0 : ((x - from.x) * dx + (y - from.y) * dy) / lengthSquared,
  );
};

export const radialGradient = (
  buffer: PixelBuffer,
  center: Point,
  radius: number,
  start: RgbaColor,
  end: RgbaColor,
  selection?: SelectionMask | null,
): void => {
  paintGradient(buffer, start, end, selection, (x, y) =>
    radius <= 0 ? 1 : Math.hypot(x - center.x, y - center.y) / radius,
  );
};

export const bucketFill = (
  buffer: PixelBuffer,
  x: number,
  y: number,
  color: RgbaColor,
  options: BucketOptions,
): SelectionMask => {
  const region = magicWand(options.sample ?? buffer, x, y, options);
  const limited =
    options.selection === null || options.selection === undefined
      ? region
      : combineMasks(region, options.selection, SelectionCombine.Intersect);
  fillSelection(buffer, color, limited);
  return limited;
};

export const sampleColor = (
  buffer: PixelBuffer,
  x: number,
  y: number,
  size: SampleSize,
): RgbaColor | null => {
  if (!inBounds(buffer, x, y)) return null;
  const reach = (size - 1) / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let pixels = 0;
  for (let py = Math.max(0, y - reach); py <= Math.min(buffer.height - 1, y + reach); py += 1) {
    for (let px = Math.max(0, x - reach); px <= Math.min(buffer.width - 1, x + reach); px += 1) {
      const i = (py * buffer.width + px) * 4;
      const alpha = at(buffer.data, i + 3);
      r += at(buffer.data, i) * alpha;
      g += at(buffer.data, i + 1) * alpha;
      b += at(buffer.data, i + 2) * alpha;
      a += alpha;
      pixels += 1;
    }
  }
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round(r / a),
    g: Math.round(g / a),
    b: Math.round(b / a),
    a: Math.round(a / pixels),
  };
};
