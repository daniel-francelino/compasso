import { describe, expect, it } from "vitest";
import { ToneRange } from "@/lib/shared/design/raster/adjustment-types";
import { beginStroke, finishStroke, stampShaded } from "@/lib/shared/design/raster/brush";
import { createPixelBuffer, getPixel } from "@/lib/shared/design/raster/pixel-buffer";
import {
  ToneMode,
  cloneOffset,
  cloneShader,
  lumaOf,
  rangeWeight,
  toneChannel,
  toneShader,
} from "@/lib/shared/design/raster/retouch";

const PARAMS = {
  size: 5,
  hardness: 1,
  opacity: 1,
  flow: 1,
  color: { r: 0, g: 0, b: 0 },
  erase: false,
};

describe("tone weights", () => {
  it("weights each range around its tones", () => {
    expect(rangeWeight(ToneRange.Shadows, 0)).toBe(1);
    expect(rangeWeight(ToneRange.Shadows, 0.5)).toBe(0);
    expect(rangeWeight(ToneRange.Highlights, 1)).toBe(1);
    expect(rangeWeight(ToneRange.Highlights, 0.5)).toBe(0);
    expect(rangeWeight(ToneRange.Midtones, 0.5)).toBe(1);
    expect(rangeWeight(ToneRange.Midtones, 0)).toBe(0);
  });

  it("measures luma between 0 and 1", () => {
    expect(lumaOf(0, 0, 0)).toBe(0);
    expect(lumaOf(255, 255, 255)).toBeCloseTo(1, 5);
  });

  it("dodge lightens and burn darkens", () => {
    expect(toneChannel(100, ToneMode.Dodge, 0.5)).toBeCloseTo(177.5);
    expect(toneChannel(100, ToneMode.Burn, 0.5)).toBeCloseTo(50);
    expect(toneChannel(100, ToneMode.Dodge, 0)).toBe(100);
  });
});

describe("tone shader on a stroke", () => {
  it("brightens midtones and keeps alpha", () => {
    const buffer = createPixelBuffer(9, 9, { r: 128, g: 128, b: 128, a: 200 });
    const stroke = beginStroke(buffer);
    const shade = toneShader({ mode: ToneMode.Dodge, range: ToneRange.Midtones, exposure: 1 });
    stampShaded(stroke, 4.5, 4.5, PARAMS, shade);
    const center = getPixel(buffer, 4, 4);
    expect(center.r).toBeGreaterThan(200);
    expect(center.a).toBe(200);
    expect(finishStroke(stroke).tiles.length).toBe(1);
  });

  it("leaves pure highlights alone when burning shadows", () => {
    const buffer = createPixelBuffer(9, 9, { r: 250, g: 250, b: 250, a: 255 });
    const stroke = beginStroke(buffer);
    const shade = toneShader({ mode: ToneMode.Burn, range: ToneRange.Shadows, exposure: 1 });
    stampShaded(stroke, 4.5, 4.5, PARAMS, shade);
    expect(getPixel(buffer, 4, 4).r).toBe(250);
  });

  it("does not compound inside one stroke beyond the coverage", () => {
    const buffer = createPixelBuffer(9, 9, { r: 128, g: 128, b: 128, a: 255 });
    const stroke = beginStroke(buffer);
    const shade = toneShader({ mode: ToneMode.Burn, range: ToneRange.Midtones, exposure: 0.5 });
    stampShaded(stroke, 4.5, 4.5, PARAMS, shade);
    const once = getPixel(buffer, 4, 4).r;
    stampShaded(stroke, 4.5, 4.5, PARAMS, shade);
    expect(getPixel(buffer, 4, 4).r).toBe(once);
  });
});

describe("clone offset and shader", () => {
  it("computes the offset from the source to the first dab", () => {
    expect(cloneOffset({ x: 10, y: 4 }, { x: 2, y: 9 })).toEqual({ x: 8, y: -5 });
  });

  it("copies the source pixels to the destination", () => {
    const buffer = createPixelBuffer(32, 8);
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const i = (y * 32 + x) * 4;
        buffer.data.set([200, 10, 30, 255], i);
      }
    }
    const stroke = beginStroke(buffer);
    const shade = cloneShader(stroke, { x: -20, y: 0 });
    stampShaded(stroke, 24.5, 4.5, { ...PARAMS, size: 5 }, shade);
    const copied = getPixel(buffer, 24, 4);
    expect(copied).toEqual({ r: 200, g: 10, b: 30, a: 255 });
    expect(getPixel(buffer, 31, 0).a).toBe(0);
  });

  it("reads the source as it was at the start of the stroke", () => {
    const buffer = createPixelBuffer(16, 4, { r: 10, g: 10, b: 10, a: 255 });
    buffer.data.set([250, 0, 0, 255], (2 * 16 + 4) * 4);
    const stroke = beginStroke(buffer);
    const shade = cloneShader(stroke, { x: -2, y: 0 });
    stampShaded(stroke, 6.5, 2.5, { ...PARAMS, size: 1 }, shade);
    stampShaded(stroke, 8.5, 2.5, { ...PARAMS, size: 1 }, shade);
    expect(getPixel(buffer, 6, 2).r).toBe(250);
    expect(getPixel(buffer, 8, 2).r).toBe(10);
  });

  it("ignores sources outside the layer", () => {
    const buffer = createPixelBuffer(8, 8, { r: 5, g: 5, b: 5, a: 255 });
    const stroke = beginStroke(buffer);
    stampShaded(stroke, 1.5, 1.5, PARAMS, cloneShader(stroke, { x: -50, y: 0 }));
    expect(finishStroke(stroke).tiles.length).toBe(0);
  });
});
