import { at } from "@/lib/shared/design/raster/numeric";

export type PixelBuffer = { width: number; height: number; data: Uint8ClampedArray };

export type RgbaColor = { r: number; g: number; b: number; a: number };

export type Point = { x: number; y: number };

export type Rect = { x: number; y: number; width: number; height: number };

export const createPixelBuffer = (width: number, height: number, fill?: RgbaColor): PixelBuffer => {
  const data = new Uint8ClampedArray(width * height * 4);
  const buffer = { width, height, data };
  if (fill === undefined) return buffer;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill.r;
    data[i + 1] = fill.g;
    data[i + 2] = fill.b;
    data[i + 3] = fill.a;
  }
  return buffer;
};

export const clonePixelBuffer = (buffer: PixelBuffer): PixelBuffer => ({
  width: buffer.width,
  height: buffer.height,
  data: new Uint8ClampedArray(buffer.data),
});

export const inBounds = (buffer: { width: number; height: number }, x: number, y: number) =>
  x >= 0 && y >= 0 && x < buffer.width && y < buffer.height;

export const getPixel = (buffer: PixelBuffer, x: number, y: number): RgbaColor => {
  if (!inBounds(buffer, x, y)) return { r: 0, g: 0, b: 0, a: 0 };
  const i = (y * buffer.width + x) * 4;
  const data = buffer.data;
  return { r: at(data, i), g: at(data, i + 1), b: at(data, i + 2), a: at(data, i + 3) };
};

export const setPixel = (buffer: PixelBuffer, x: number, y: number, color: RgbaColor): void => {
  if (!inBounds(buffer, x, y)) return;
  const i = (y * buffer.width + x) * 4;
  buffer.data[i] = color.r;
  buffer.data[i + 1] = color.g;
  buffer.data[i + 2] = color.b;
  buffer.data[i + 3] = color.a;
};

export const sameSize = (
  a: { width: number; height: number },
  b: { width: number; height: number },
) => a.width === b.width && a.height === b.height;
