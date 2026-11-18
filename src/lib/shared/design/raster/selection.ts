import { at, clamp } from "@/lib/shared/design/raster/numeric";
import type { PixelBuffer, Point, Rect } from "@/lib/shared/design/raster/pixel-buffer";
import type { ValueOf } from "@/lib/shared/utils";

export type SelectionMask = { width: number; height: number; data: Uint8Array };

export const SelectionCombine = {
  Replace: "replace",
  Add: "add",
  Subtract: "subtract",
  Intersect: "intersect",
} as const;
export type SelectionCombine = ValueOf<typeof SelectionCombine>;

export type WandOptions = { tolerance: number; contiguous: boolean };

export type OutlineSegment = { x1: number; y1: number; x2: number; y2: number };

export type Outline = { segments: OutlineSegment[]; truncated: boolean };

export const MAX_OUTLINE_SEGMENTS = 20000;
export const SELECTED_THRESHOLD = 128;
const FEATHER_PASSES = 3;

export const createMask = (width: number, height: number, value = 0): SelectionMask => {
  const data = new Uint8Array(width * height);
  if (value !== 0) data.fill(value);
  return { width, height, data };
};

export const cloneMask = (mask: SelectionMask): SelectionMask => ({
  width: mask.width,
  height: mask.height,
  data: new Uint8Array(mask.data),
});

const overlap = (start: number, size: number, cell: number): number =>
  clamp(Math.min(start + size, cell + 1) - Math.max(start, cell), 0, 1);

export const rectMask = (width: number, height: number, rect: Rect): SelectionMask => {
  const mask = createMask(width, height);
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(height, Math.ceil(rect.y + rect.height));
  for (let y = y0; y < y1; y += 1) {
    const cy = overlap(rect.y, rect.height, y);
    for (let x = x0; x < x1; x += 1) {
      mask.data[y * width + x] = Math.round(overlap(rect.x, rect.width, x) * cy * 255);
    }
  }
  return mask;
};

export const ellipseMask = (width: number, height: number, rect: Rect): SelectionMask => {
  const mask = createMask(width, height);
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  if (rx <= 0 || ry <= 0) return mask;
  const cx = rect.x + rx;
  const cy = rect.y + ry;
  const x0 = Math.max(0, Math.floor(rect.x) - 1);
  const y0 = Math.max(0, Math.floor(rect.y) - 1);
  const x1 = Math.min(width, Math.ceil(rect.x + rect.width) + 1);
  const y1 = Math.min(height, Math.ceil(rect.y + rect.height) + 1);
  for (let y = y0; y < y1; y += 1) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x < x1; x += 1) {
      const dx = x + 0.5 - cx;
      const e = Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
      if (e === 0) {
        mask.data[y * width + x] = 255;
        continue;
      }
      const gradient = Math.sqrt((dx / (rx * rx)) ** 2 + (dy / (ry * ry)) ** 2) / e;
      const distance = (e - 1) / gradient;
      mask.data[y * width + x] = Math.round(clamp(0.5 - distance, 0, 1) * 255);
    }
  }
  return mask;
};

export const polygonMask = (
  width: number,
  height: number,
  points: readonly Point[],
): SelectionMask => {
  const mask = createMask(width, height);
  if (points.length < 3) return mask;
  const crossings: number[] = [];
  for (let y = 0; y < height; y += 1) {
    const sampleY = y + 0.5;
    crossings.length = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a === undefined || b === undefined) continue;
      if (a.y <= sampleY === b.y <= sampleY) continue;
      crossings.push(a.x + ((sampleY - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    crossings.sort((p, q) => p - q);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil(at(crossings, k) - 0.5));
      const to = Math.min(width, Math.ceil(at(crossings, k + 1) - 0.5));
      if (to > from) mask.data.fill(255, y * width + from, y * width + to);
    }
  }
  return mask;
};

const globalMatch = (out: SelectionMask, matches: (pixel: number) => boolean): SelectionMask => {
  for (let p = 0; p < out.data.length; p += 1) {
    if (matches(p)) out.data[p] = 255;
  }
  return out;
};

export const magicWand = (
  sample: PixelBuffer,
  x: number,
  y: number,
  options: WandOptions,
): SelectionMask => {
  const { width, height, data } = sample;
  const out = createMask(width, height);
  if (x < 0 || y < 0 || x >= width || y >= height) return out;
  const seed = (y * width + x) * 4;
  const sr = at(data, seed);
  const sg = at(data, seed + 1);
  const sb = at(data, seed + 2);
  const sa = at(data, seed + 3);
  const tolerance = clamp(options.tolerance, 0, 255);
  const matches = (pixel: number): boolean => {
    const i = pixel * 4;
    return (
      Math.abs(at(data, i) - sr) <= tolerance &&
      Math.abs(at(data, i + 1) - sg) <= tolerance &&
      Math.abs(at(data, i + 2) - sb) <= tolerance &&
      Math.abs(at(data, i + 3) - sa) <= tolerance
    );
  };
  if (!options.contiguous) return globalMatch(out, matches);
  const stack: number[] = [x, y];
  const pushRuns = (row: number, from: number, to: number): void => {
    if (row < 0 || row >= height) return;
    let inRun = false;
    for (let i = from; i <= to; i += 1) {
      const hit = at(out.data, row * width + i) === 0 && matches(row * width + i);
      if (hit && !inRun) stack.push(i, row);
      inRun = hit;
    }
  };
  while (stack.length > 0) {
    const cy = stack.pop() ?? 0;
    const cx = stack.pop() ?? 0;
    const base = cy * width;
    if (at(out.data, base + cx) !== 0 || !matches(base + cx)) continue;
    let left = cx;
    while (left > 0 && at(out.data, base + left - 1) === 0 && matches(base + left - 1)) left -= 1;
    let right = cx;
    while (right < width - 1 && at(out.data, base + right + 1) === 0 && matches(base + right + 1)) {
      right += 1;
    }
    out.data.fill(255, base + left, base + right + 1);
    pushRuns(cy - 1, left, right);
    pushRuns(cy + 1, left, right);
  }
  return out;
};

const combineValue = (mode: SelectionCombine, a: number, b: number): number => {
  switch (mode) {
    case SelectionCombine.Add:
      return a + b - (a * b) / 255;
    case SelectionCombine.Subtract:
      return (a * (255 - b)) / 255;
    case SelectionCombine.Intersect:
      return (a * b) / 255;
    case SelectionCombine.Replace:
      return b;
  }
};

export const combineMasks = (
  base: SelectionMask,
  incoming: SelectionMask,
  mode: SelectionCombine,
): SelectionMask => {
  const out = createMask(base.width, base.height);
  for (let i = 0; i < out.data.length; i += 1) {
    out.data[i] = Math.round(combineValue(mode, at(base.data, i), at(incoming.data, i)));
  }
  return out;
};

export const invertMask = (mask: SelectionMask): SelectionMask => {
  const out = createMask(mask.width, mask.height);
  for (let i = 0; i < out.data.length; i += 1) out.data[i] = 255 - at(mask.data, i);
  return out;
};

export const maskBoundingBox = (mask: SelectionMask, threshold = 1): Rect | null => {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (at(mask.data, y * mask.width + x) < threshold) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

const boxSizes = (sigma: number): number[] => {
  const ideal = Math.sqrt((12 * sigma * sigma) / FEATHER_PASSES + 1);
  let lower = Math.floor(ideal);
  if (lower % 2 === 0) lower -= 1;
  const upper = lower + 2;
  const split = Math.round(
    (12 * sigma * sigma -
      FEATHER_PASSES * lower * lower -
      4 * FEATHER_PASSES * lower -
      3 * FEATHER_PASSES) /
      (-4 * lower - 4),
  );
  return Array.from({ length: FEATHER_PASSES }, (_, i) => (i < split ? lower : upper));
};

const boxLine = (
  src: Float32Array,
  dst: Float32Array,
  start: number,
  stride: number,
  count: number,
  radius: number,
): void => {
  const size = 2 * radius + 1;
  let sum = at(src, start) * (radius + 1);
  for (let j = 1; j <= radius; j += 1) sum += at(src, start + Math.min(j, count - 1) * stride);
  for (let i = 0; i < count; i += 1) {
    dst[start + i * stride] = sum / size;
    sum +=
      at(src, start + Math.min(i + radius + 1, count - 1) * stride) -
      at(src, start + Math.max(i - radius, 0) * stride);
  }
};

export const featherMask = (mask: SelectionMask, radius: number): SelectionMask => {
  if (radius <= 0) return cloneMask(mask);
  const { width, height } = mask;
  const current = Float32Array.from(mask.data);
  const scratch = new Float32Array(current.length);
  for (const size of boxSizes(radius / 2)) {
    const r = (size - 1) / 2;
    if (r < 1) continue;
    for (let y = 0; y < height; y += 1) boxLine(current, scratch, y * width, 1, width, r);
    for (let x = 0; x < width; x += 1) boxLine(scratch, current, x, width, height, r);
  }
  const out = createMask(width, height);
  for (let i = 0; i < out.data.length; i += 1) out.data[i] = Math.round(at(current, i));
  return out;
};

const slidingExtreme = (
  src: Uint8Array,
  dst: Uint8Array,
  queue: Int32Array,
  start: number,
  stride: number,
  count: number,
  radius: number,
): void => {
  let head = 0;
  let tail = 0;
  let next = 0;
  for (let i = 0; i < count; i += 1) {
    const high = Math.min(i + radius, count - 1);
    while (next <= high) {
      const value = at(src, start + next * stride);
      while (tail > head && at(src, start + at(queue, tail - 1) * stride) <= value) tail -= 1;
      queue[tail] = next;
      tail += 1;
      next += 1;
    }
    while (at(queue, head) < i - radius) head += 1;
    dst[start + i * stride] = at(src, start + at(queue, head) * stride);
  }
};

export const growMask = (mask: SelectionMask, radius: number): SelectionMask => {
  const r = Math.round(radius);
  if (r <= 0) return cloneMask(mask);
  const { width, height } = mask;
  const queue = new Int32Array(Math.max(width, height));
  const middle = createMask(width, height);
  const out = createMask(width, height);
  for (let y = 0; y < height; y += 1) {
    slidingExtreme(mask.data, middle.data, queue, y * width, 1, width, r);
  }
  for (let x = 0; x < width; x += 1)
    slidingExtreme(middle.data, out.data, queue, x, width, height, r);
  return out;
};

export const shrinkMask = (mask: SelectionMask, radius: number): SelectionMask =>
  invertMask(growMask(invertMask(mask), radius));

const selectedAt = (mask: SelectionMask, x: number, y: number): boolean =>
  x >= 0 &&
  y >= 0 &&
  x < mask.width &&
  y < mask.height &&
  at(mask.data, y * mask.width + x) >= SELECTED_THRESHOLD;

export const maskOutline = (mask: SelectionMask, maxSegments = MAX_OUTLINE_SEGMENTS): Outline => {
  const segments: OutlineSegment[] = [];
  let truncated = false;
  const add = (segment: OutlineSegment): void => {
    if (segments.length >= maxSegments) {
      truncated = true;
      return;
    }
    segments.push(segment);
  };
  for (let y = 0; y <= mask.height && !truncated; y += 1) {
    let runStart = -1;
    for (let x = 0; x <= mask.width; x += 1) {
      const edge = x < mask.width && selectedAt(mask, x, y - 1) !== selectedAt(mask, x, y);
      if (edge && runStart < 0) runStart = x;
      if (!edge && runStart >= 0) {
        add({ x1: runStart, y1: y, x2: x, y2: y });
        runStart = -1;
      }
    }
  }
  for (let x = 0; x <= mask.width && !truncated; x += 1) {
    let runStart = -1;
    for (let y = 0; y <= mask.height; y += 1) {
      const edge = y < mask.height && selectedAt(mask, x - 1, y) !== selectedAt(mask, x, y);
      if (edge && runStart < 0) runStart = y;
      if (!edge && runStart >= 0) {
        add({ x1: x, y1: runStart, x2: x, y2: y });
        runStart = -1;
      }
    }
  }
  return { segments, truncated };
};
