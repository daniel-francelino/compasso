import { at } from "@/lib/shared/design/raster/numeric";

export const paintPixel = (
  dst: Uint8ClampedArray,
  di: number,
  base: Uint8ClampedArray,
  bi: number,
  color: { r: number; g: number; b: number },
  alpha: number,
  erase: boolean,
): void => {
  const baseAlpha = at(base, bi + 3) / 255;
  if (erase) {
    dst[di] = at(base, bi);
    dst[di + 1] = at(base, bi + 1);
    dst[di + 2] = at(base, bi + 2);
    dst[di + 3] = baseAlpha * (1 - alpha) * 255;
    return;
  }
  const resultAlpha = alpha + baseAlpha * (1 - alpha);
  if (resultAlpha <= 0) return;
  const keep = (1 - alpha) * baseAlpha;
  dst[di] = (alpha * color.r + keep * at(base, bi)) / resultAlpha;
  dst[di + 1] = (alpha * color.g + keep * at(base, bi + 1)) / resultAlpha;
  dst[di + 2] = (alpha * color.b + keep * at(base, bi + 2)) / resultAlpha;
  dst[di + 3] = resultAlpha * 255;
};
