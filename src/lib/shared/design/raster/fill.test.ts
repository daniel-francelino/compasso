import { describe, expect, it } from "vitest";
import {
  SampleSize,
  bucketFill,
  fillSelection,
  linearGradient,
  radialGradient,
  sampleColor,
} from "@/lib/shared/design/raster/fill";
import { createPixelBuffer, getPixel, setPixel } from "@/lib/shared/design/raster/pixel-buffer";
import { createMask, rectMask } from "@/lib/shared/design/raster/selection";

const red = { r: 255, g: 0, b: 0, a: 255 };
const blue = { r: 0, g: 0, b: 255, a: 255 };

describe("fillSelection", () => {
  it("fills everything without a selection", () => {
    const buffer = createPixelBuffer(2, 2);
    fillSelection(buffer, red);
    expect(getPixel(buffer, 1, 1)).toEqual(red);
  });

  it("fills only the selection and scales by selection coverage and color alpha", () => {
    const buffer = createPixelBuffer(3, 1);
    const selection = createMask(3, 1);
    selection.data.set([255, 128, 0]);
    fillSelection(buffer, red, selection);
    expect(getPixel(buffer, 0, 0)).toEqual(red);
    expect(getPixel(buffer, 1, 0).a).toBe(128);
    expect(getPixel(buffer, 2, 0).a).toBe(0);
    const half = createPixelBuffer(1, 1);
    fillSelection(half, { ...red, a: 128 });
    expect(getPixel(half, 0, 0).a).toBe(128);
  });
});

describe("gradients", () => {
  it("interpolates linearly between two points and clamps outside", () => {
    const buffer = createPixelBuffer(4, 1);
    linearGradient(buffer, { x: 0, y: 0 }, { x: 4, y: 0 }, red, blue);
    expect(getPixel(buffer, 0, 0).r).toBe(223);
    expect(getPixel(buffer, 3, 0).b).toBe(223);
    const clipped = createPixelBuffer(4, 1);
    linearGradient(clipped, { x: 1, y: 0 }, { x: 2, y: 0 }, red, blue);
    expect(getPixel(clipped, 0, 0)).toEqual(red);
    expect(getPixel(clipped, 3, 0)).toEqual(blue);
  });

  it("respects the selection and handles a zero length", () => {
    const buffer = createPixelBuffer(2, 1);
    linearGradient(
      buffer,
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      red,
      blue,
      rectMask(2, 1, { x: 0, y: 0, width: 1, height: 1 }),
    );
    expect(getPixel(buffer, 0, 0)).toEqual(red);
    expect(getPixel(buffer, 1, 0).a).toBe(0);
  });

  it("radial gradient goes from center to edge color", () => {
    const buffer = createPixelBuffer(9, 9);
    radialGradient(buffer, { x: 4.5, y: 4.5 }, 4, red, blue);
    expect(getPixel(buffer, 4, 4).r).toBe(255);
    expect(getPixel(buffer, 0, 0)).toEqual(blue);
    expect(getPixel(buffer, 4, 4).b).toBeLessThan(getPixel(buffer, 4, 1).b);
  });
});

describe("bucketFill", () => {
  const split = () => {
    const buffer = createPixelBuffer(4, 2, { r: 255, g: 255, b: 255, a: 255 });
    for (let y = 0; y < 2; y += 1) setPixel(buffer, 2, y, { r: 0, g: 0, b: 0, a: 255 });
    return buffer;
  };

  it("fills the contiguous region", () => {
    const buffer = split();
    bucketFill(buffer, 0, 0, red, { tolerance: 0, contiguous: true });
    expect(getPixel(buffer, 1, 1)).toEqual(red);
    expect(getPixel(buffer, 3, 0).r).toBe(255);
    expect(getPixel(buffer, 3, 0).g).toBe(255);
  });

  it("is limited by a selection and can sample another buffer", () => {
    const buffer = split();
    const selection = rectMask(4, 2, { x: 0, y: 0, width: 1, height: 2 });
    bucketFill(buffer, 0, 0, red, { tolerance: 0, contiguous: true, selection });
    expect(getPixel(buffer, 0, 0).g).toBe(0);
    expect(getPixel(buffer, 1, 0).g).toBe(255);
    const target = createPixelBuffer(4, 2);
    bucketFill(target, 0, 0, blue, { tolerance: 0, contiguous: false, sample: split() });
    expect(getPixel(target, 0, 0)).toEqual(blue);
    expect(getPixel(target, 2, 0).a).toBe(0);
  });
});

describe("sampleColor", () => {
  const checker = () => {
    const buffer = createPixelBuffer(5, 5, { r: 0, g: 0, b: 0, a: 255 });
    setPixel(buffer, 2, 2, { r: 90, g: 90, b: 90, a: 255 });
    return buffer;
  };

  it("reads one pixel, 3x3 and 5x5 averages", () => {
    expect(sampleColor(checker(), 2, 2, SampleSize.Single)).toEqual({
      r: 90,
      g: 90,
      b: 90,
      a: 255,
    });
    expect(sampleColor(checker(), 2, 2, SampleSize.Three)?.r).toBe(10);
    expect(sampleColor(checker(), 2, 2, SampleSize.Five)?.r).toBe(4);
  });

  it("clips the window at the border, weights by alpha and rejects outside points", () => {
    expect(sampleColor(checker(), 0, 0, SampleSize.Five)?.r).toBe(10);
    const mixed = createPixelBuffer(2, 1);
    setPixel(mixed, 0, 0, { r: 200, g: 0, b: 0, a: 255 });
    expect(sampleColor(mixed, 0, 0, SampleSize.Three)).toEqual({ r: 200, g: 0, b: 0, a: 128 });
    expect(sampleColor(checker(), 9, 0, SampleSize.Single)).toBeNull();
  });
});
