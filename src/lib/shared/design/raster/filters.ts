import { at, clamp, clampByte } from "@/lib/shared/design/raster/numeric";
import {
  clonePixelBuffer,
  createPixelBuffer,
  type PixelBuffer,
} from "@/lib/shared/design/raster/pixel-buffer";

export type UnsharpParams = { amount: number; radius: number; threshold: number };

export type NoiseParams = { amount: number; monochrome: boolean };

const KERNEL_SIGMAS = 3;

const gaussianKernel = (sigma: number): Float32Array => {
  const half = Math.max(1, Math.ceil(sigma * KERNEL_SIGMAS));
  const kernel = new Float32Array(2 * half + 1);
  let total = 0;
  for (let i = -half; i <= half; i += 1) {
    const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + half] = weight;
    total += weight;
  }
  for (let i = 0; i < kernel.length; i += 1) kernel[i] = at(kernel, i) / total;
  return kernel;
};

const convolveLine = (
  line: Float32Array,
  out: Float32Array,
  length: number,
  kernel: Float32Array,
): void => {
  const half = (kernel.length - 1) / 2;
  for (let i = 0; i < length; i += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let k = -half; k <= half; k += 1) {
      const source = Math.min(Math.max(i + k, 0), length - 1) * 4;
      const weight = at(kernel, k + half);
      r += at(line, source) * weight;
      g += at(line, source + 1) * weight;
      b += at(line, source + 2) * weight;
      a += at(line, source + 3) * weight;
    }
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  }
};

const verticalRow = (
  premultiplied: Float32Array,
  acc: Float32Array,
  y: number,
  width: number,
  height: number,
  kernel: Float32Array,
): void => {
  const half = (kernel.length - 1) / 2;
  const rowLength = width * 4;
  acc.fill(0);
  for (let k = -half; k <= half; k += 1) {
    const start = Math.min(Math.max(y + k, 0), height - 1) * rowLength;
    const weight = at(kernel, k + half);
    for (let i = 0; i < rowLength; i += 1)
      acc[i] = at(acc, i) + at(premultiplied, start + i) * weight;
  }
};

export const gaussianBlur = (buffer: PixelBuffer, radius: number): PixelBuffer => {
  if (radius <= 0) return clonePixelBuffer(buffer);
  const { width, height, data } = buffer;
  const kernel = gaussianKernel(radius);
  const premultiplied = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = at(data, i + 3);
    premultiplied[i] = (at(data, i) * alpha) / 255;
    premultiplied[i + 1] = (at(data, i + 1) * alpha) / 255;
    premultiplied[i + 2] = (at(data, i + 2) * alpha) / 255;
    premultiplied[i + 3] = alpha;
  }
  const line = new Float32Array(width * 4);
  const result = new Float32Array(width * 4);
  for (let y = 0; y < height; y += 1) {
    const start = y * width * 4;
    line.set(premultiplied.subarray(start, start + width * 4));
    convolveLine(line, result, width, kernel);
    premultiplied.set(result, start);
  }
  const out = createPixelBuffer(width, height);
  for (let y = 0; y < height; y += 1) {
    verticalRow(premultiplied, result, y, width, height, kernel);
    for (let x = 0; x < width; x += 1) {
      const alpha = at(result, x * 4 + 3);
      if (alpha <= 0) continue;
      const o = (y * width + x) * 4;
      out.data[o] = (at(result, x * 4) * 255) / alpha;
      out.data[o + 1] = (at(result, x * 4 + 1) * 255) / alpha;
      out.data[o + 2] = (at(result, x * 4 + 2) * 255) / alpha;
      out.data[o + 3] = alpha;
    }
  }
  return out;
};

export const unsharpMask = (buffer: PixelBuffer, params: UnsharpParams): PixelBuffer => {
  const blurred = gaussianBlur(buffer, params.radius);
  const out = clonePixelBuffer(buffer);
  const gain = params.amount / 100;
  for (let i = 0; i < out.data.length; i += 4) {
    if (at(buffer.data, i + 3) === 0) continue;
    for (let c = 0; c < 3; c += 1) {
      const original = at(buffer.data, i + c);
      const difference = original - at(blurred.data, i + c);
      if (Math.abs(difference) < params.threshold) continue;
      out.data[i + c] = clampByte(original + gain * difference);
    }
  }
  return out;
};

export const addNoise = (
  buffer: PixelBuffer,
  params: NoiseParams,
  random: () => number,
): PixelBuffer => {
  const out = clonePixelBuffer(buffer);
  const range = (clamp(params.amount, 0, 100) / 100) * 255;
  for (let i = 0; i < out.data.length; i += 4) {
    if (at(buffer.data, i + 3) === 0) continue;
    const shared = (random() * 2 - 1) * range;
    for (let c = 0; c < 3; c += 1) {
      const delta = params.monochrome ? shared : (random() * 2 - 1) * range;
      out.data[i + c] = clampByte(at(buffer.data, i + c) + delta);
    }
  }
  return out;
};

export const pixelate = (buffer: PixelBuffer, cell: number): PixelBuffer => {
  const size = Math.floor(cell);
  if (size <= 1) return clonePixelBuffer(buffer);
  const { width, height, data } = buffer;
  const out = createPixelBuffer(width, height);
  for (let y0 = 0; y0 < height; y0 += size) {
    for (let x0 = 0; x0 < width; x0 += size) {
      const x1 = Math.min(x0 + size, width);
      const y1 = Math.min(y0 + size, height);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * width + x) * 4;
          const alpha = at(data, i + 3);
          r += at(data, i) * alpha;
          g += at(data, i + 1) * alpha;
          b += at(data, i + 2) * alpha;
          a += alpha;
        }
      }
      const pixels = (x1 - x0) * (y1 - y0);
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * width + x) * 4;
          out.data[i] = a > 0 ? r / a : 0;
          out.data[i + 1] = a > 0 ? g / a : 0;
          out.data[i + 2] = a > 0 ? b / a : 0;
          out.data[i + 3] = a / pixels;
        }
      }
    }
  }
  return out;
};
