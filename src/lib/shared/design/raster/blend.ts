import { DesignBlendMode } from "@/lib/shared/design/types";
import { at, clamp01 } from "@/lib/shared/design/raster/numeric";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";

export type CoverageMask = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

export type BlendOptions = {
  mode: DesignBlendMode;
  opacity?: number;
  fillOpacity?: number;
  mask?: CoverageMask | null;
  x?: number;
  y?: number;
  clip?: CoverageMask | null;
};

export type BlendLayer = BlendOptions & { source: PixelBuffer };

const tmp = new Float64Array(3);
const colorBackdrop = new Float64Array(3);
const colorSource = new Float64Array(3);
const colorResult = new Float64Array(3);

const multiply = (b: number, s: number): number => b * s;
const screen = (b: number, s: number): number => b + s - b * s;
const hardLight = (b: number, s: number): number =>
  s <= 0.5 ? multiply(b, 2 * s) : screen(b, 2 * s - 1);

const softLight = (b: number, s: number): number => {
  if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
  return b + (2 * s - 1) * (d - b);
};

const colorDodge = (b: number, s: number): number => {
  if (b === 0) return 0;
  if (s >= 1) return 1;
  return Math.min(1, b / (1 - s));
};

const colorBurn = (b: number, s: number): number => {
  if (b >= 1) return 1;
  if (s <= 0) return 0;
  return 1 - Math.min(1, (1 - b) / s);
};

export const blendChannel = (mode: DesignBlendMode, b: number, s: number): number => {
  switch (mode) {
    case DesignBlendMode.Multiply:
      return multiply(b, s);
    case DesignBlendMode.Screen:
      return screen(b, s);
    case DesignBlendMode.Overlay:
      return hardLight(s, b);
    case DesignBlendMode.Darken:
      return Math.min(b, s);
    case DesignBlendMode.Lighten:
      return Math.max(b, s);
    case DesignBlendMode.ColorDodge:
      return colorDodge(b, s);
    case DesignBlendMode.ColorBurn:
      return colorBurn(b, s);
    case DesignBlendMode.HardLight:
      return hardLight(b, s);
    case DesignBlendMode.SoftLight:
      return softLight(b, s);
    case DesignBlendMode.Difference:
      return Math.abs(b - s);
    case DesignBlendMode.Exclusion:
      return b + s - 2 * b * s;
    default:
      return s;
  }
};

const luminosity = (c: Float64Array): number => 0.3 * at(c, 0) + 0.59 * at(c, 1) + 0.11 * at(c, 2);

const saturationOf = (c: Float64Array): number =>
  Math.max(at(c, 0), at(c, 1), at(c, 2)) - Math.min(at(c, 0), at(c, 1), at(c, 2));

const setSaturation = (c: Float64Array, s: number): void => {
  const min = Math.min(at(c, 0), at(c, 1), at(c, 2));
  const range = Math.max(at(c, 0), at(c, 1), at(c, 2)) - min;
  for (let i = 0; i < 3; i += 1) c[i] = range > 0 ? ((at(c, i) - min) * s) / range : 0;
};

const clipColor = (c: Float64Array): void => {
  const l = luminosity(c);
  const n = Math.min(at(c, 0), at(c, 1), at(c, 2));
  const x = Math.max(at(c, 0), at(c, 1), at(c, 2));
  if (n < 0) {
    for (let i = 0; i < 3; i += 1) c[i] = l + ((at(c, i) - l) * l) / (l - n);
  }
  if (x > 1) {
    for (let i = 0; i < 3; i += 1) c[i] = l + ((at(c, i) - l) * (1 - l)) / (x - l);
  }
};

const setLuminosity = (c: Float64Array, l: number, out: Float64Array): void => {
  const d = l - luminosity(c);
  for (let i = 0; i < 3; i += 1) out[i] = at(c, i) + d;
  clipColor(out);
};

const nonSeparable = (
  mode: DesignBlendMode,
  cb: Float64Array,
  cs: Float64Array,
  out: Float64Array,
): void => {
  if (mode === DesignBlendMode.Hue) {
    tmp.set(cs);
    setSaturation(tmp, saturationOf(cb));
    setLuminosity(tmp, luminosity(cb), out);
    return;
  }
  if (mode === DesignBlendMode.Saturation) {
    tmp.set(cb);
    setSaturation(tmp, saturationOf(cs));
    setLuminosity(tmp, luminosity(cb), out);
    return;
  }
  if (mode === DesignBlendMode.Color) {
    setLuminosity(cs, luminosity(cb), out);
    return;
  }
  setLuminosity(cb, luminosity(cs), out);
};

const NON_SEPARABLE = new Set<DesignBlendMode>([
  DesignBlendMode.Hue,
  DesignBlendMode.Saturation,
  DesignBlendMode.Color,
  DesignBlendMode.Luminosity,
]);

export const blendColors = (
  mode: DesignBlendMode,
  cb: Float64Array,
  cs: Float64Array,
  out: Float64Array,
): void => {
  if (NON_SEPARABLE.has(mode)) {
    nonSeparable(mode, cb, cs, out);
    return;
  }
  for (let i = 0; i < 3; i += 1) out[i] = blendChannel(mode, at(cb, i), at(cs, i));
};

export const compositeColor = (
  mode: DesignBlendMode,
  cb: Float64Array,
  ab: number,
  cs: Float64Array,
  as: number,
  out: Float64Array,
): void => {
  const ar = as + ab * (1 - as);
  if (ar <= 0) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    return;
  }
  blendColors(mode, cb, cs, colorResult);
  for (let i = 0; i < 3; i += 1) {
    const mixed = (1 - ab) * at(cs, i) + ab * at(colorResult, i);
    out[i] = ((1 - as) * ab * at(cb, i) + as * mixed) / ar;
  }
  out[3] = ar;
};

export const blendPixel = (
  mode: DesignBlendMode,
  backdrop: readonly [number, number, number, number],
  source: readonly [number, number, number, number],
  opacity = 1,
): [number, number, number, number] => {
  const cb = Float64Array.of(backdrop[0] / 255, backdrop[1] / 255, backdrop[2] / 255);
  const cs = Float64Array.of(source[0] / 255, source[1] / 255, source[2] / 255);
  const out = new Float64Array(4);
  compositeColor(mode, cb, backdrop[3] / 255, cs, (source[3] / 255) * opacity, out);
  const byte = (value: number): number => Math.round(clamp01(value) * 255);
  return [byte(at(out, 0)), byte(at(out, 1)), byte(at(out, 2)), byte(at(out, 3))];
};

const coverageAt = (mask: CoverageMask | null | undefined, index: number): number =>
  mask === null || mask === undefined ? 1 : at(mask.data, index) / 255;

export const blendOnto = (
  target: PixelBuffer,
  source: PixelBuffer,
  options: BlendOptions,
): void => {
  const gain = clamp01(options.opacity ?? 1) * clamp01(options.fillOpacity ?? 1);
  const offsetX = options.x ?? 0;
  const offsetY = options.y ?? 0;
  const x0 = Math.max(0, offsetX);
  const y0 = Math.max(0, offsetY);
  const x1 = Math.min(target.width, offsetX + source.width);
  const y1 = Math.min(target.height, offsetY + source.height);
  const out = new Float64Array(4);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const si = ((y - offsetY) * source.width + (x - offsetX)) * 4;
      const ti = (y * target.width + x) * 4;
      const sa = at(source.data, si + 3) / 255;
      if (sa === 0) continue;
      const pixel = y * target.width + x;
      const alpha = sa * gain * coverageAt(options.mask, pixel) * coverageAt(options.clip, pixel);
      if (alpha === 0) continue;
      for (let c = 0; c < 3; c += 1) {
        colorBackdrop[c] = at(target.data, ti + c) / 255;
        colorSource[c] = at(source.data, si + c) / 255;
      }
      compositeColor(
        options.mode,
        colorBackdrop,
        at(target.data, ti + 3) / 255,
        colorSource,
        alpha,
        out,
      );
      target.data[ti] = at(out, 0) * 255;
      target.data[ti + 1] = at(out, 1) * 255;
      target.data[ti + 2] = at(out, 2) * 255;
      target.data[ti + 3] = at(out, 3) * 255;
    }
  }
};

export const compositeLayers = (
  target: PixelBuffer,
  layersBottomFirst: readonly BlendLayer[],
): void => {
  for (const layer of layersBottomFirst) blendOnto(target, layer.source, layer);
};
