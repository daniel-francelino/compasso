import type {
  CurvePoint,
  LevelsChannelParams,
} from "@/lib/shared/design/raster/adjustment-schemas";
import { at, clampByte } from "@/lib/shared/design/raster/numeric";

export type Lut = Uint8ClampedArray;

const LUT_SIZE = 256;

export const identityLut = (): Lut => {
  const lut = new Uint8ClampedArray(LUT_SIZE);
  for (let i = 0; i < LUT_SIZE; i += 1) lut[i] = i;
  return lut;
};

export const brightnessContrastLut = (brightness: number, contrast: number): Lut => {
  const lut = new Uint8ClampedArray(LUT_SIZE);
  const shift = (brightness / 100) * 255;
  const adjust = ((contrast + 100) / 100) ** 2;
  for (let i = 0; i < LUT_SIZE; i += 1) {
    const bright = clampByte(i + shift);
    lut[i] = clampByte(((bright / 255 - 0.5) * adjust + 0.5) * 255);
  }
  return lut;
};

export const levelsLut = (params: LevelsChannelParams): Lut => {
  const lut = new Uint8ClampedArray(LUT_SIZE);
  const span = Math.max(params.inputWhite - params.inputBlack, 1);
  const exponent = 1 / params.gamma;
  for (let i = 0; i < LUT_SIZE; i += 1) {
    const normalized = Math.min(Math.max((i - params.inputBlack) / span, 0), 1);
    lut[i] = clampByte(
      params.outputBlack + normalized ** exponent * (params.outputWhite - params.outputBlack),
    );
  }
  return lut;
};

const sortedUnique = (points: readonly CurvePoint[]): CurvePoint[] => {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  return sorted.filter((point, i) => i === 0 || point.x > (sorted[i - 1]?.x ?? -1));
};

const tangents = (xs: number[], ys: number[]): number[] => {
  const n = xs.length;
  const slopes: number[] = [];
  for (let k = 0; k < n - 1; k += 1) {
    slopes.push((at(ys, k + 1) - at(ys, k)) / (at(xs, k + 1) - at(xs, k)));
  }
  const m: number[] = [];
  for (let k = 0; k < n; k += 1) {
    const before = k === 0 ? at(slopes, 0) : at(slopes, k - 1);
    const after = k === n - 1 ? at(slopes, n - 2) : at(slopes, k);
    m.push(before * after <= 0 ? 0 : (before + after) / 2);
  }
  for (let k = 0; k < n - 1; k += 1) {
    const slope = at(slopes, k);
    if (slope === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const a = at(m, k) / slope;
    const b = at(m, k + 1) / slope;
    const s = a * a + b * b;
    if (s <= 9) continue;
    const t = 3 / Math.sqrt(s);
    m[k] = t * a * slope;
    m[k + 1] = t * b * slope;
  }
  return m;
};

export const curveLut = (points: readonly CurvePoint[]): Lut => {
  const lut = new Uint8ClampedArray(LUT_SIZE);
  const clean = sortedUnique(points);
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (first === undefined || last === undefined || clean.length < 2) return identityLut();
  const xs = clean.map((point) => point.x);
  const ys = clean.map((point) => point.y);
  const m = tangents(xs, ys);
  let segment = 0;
  for (let i = 0; i < LUT_SIZE; i += 1) {
    if (i <= first.x) {
      lut[i] = first.y;
      continue;
    }
    if (i >= last.x) {
      lut[i] = last.y;
      continue;
    }
    while (i > at(xs, segment + 1)) segment += 1;
    const x0 = at(xs, segment);
    const h = at(xs, segment + 1) - x0;
    const t = (i - x0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    lut[i] = clampByte(
      (2 * t3 - 3 * t2 + 1) * at(ys, segment) +
        (t3 - 2 * t2 + t) * h * at(m, segment) +
        (-2 * t3 + 3 * t2) * at(ys, segment + 1) +
        (t3 - t2) * h * at(m, segment + 1),
    );
  }
  return lut;
};

export const composeLuts = (first: Lut, second: Lut): Lut => {
  const lut = new Uint8ClampedArray(LUT_SIZE);
  for (let i = 0; i < LUT_SIZE; i += 1) lut[i] = at(second, at(first, i));
  return lut;
};
