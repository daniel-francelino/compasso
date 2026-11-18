import { describe, expect, it } from "vitest";
import { DesignBlendMode } from "@/lib/shared/design/types";
import {
  blendChannel,
  blendColors,
  blendOnto,
  blendPixel,
  compositeLayers,
} from "@/lib/shared/design/raster/blend";
import { createPixelBuffer, getPixel } from "@/lib/shared/design/raster/pixel-buffer";

const triple = (r: number, g: number, b: number) => Float64Array.of(r, g, b);

const separableCases: [DesignBlendMode, number, number, number][] = [
  [DesignBlendMode.Normal, 0.5, 0.4, 0.4],
  [DesignBlendMode.Multiply, 0.5, 0.4, 0.2],
  [DesignBlendMode.Screen, 0.5, 0.4, 0.7],
  [DesignBlendMode.Overlay, 0.25, 0.6, 0.3],
  [DesignBlendMode.Overlay, 0.75, 0.6, 0.8],
  [DesignBlendMode.Darken, 0.5, 0.3, 0.3],
  [DesignBlendMode.Lighten, 0.5, 0.3, 0.5],
  [DesignBlendMode.ColorDodge, 0.25, 0.5, 0.5],
  [DesignBlendMode.ColorDodge, 0, 0.5, 0],
  [DesignBlendMode.ColorDodge, 0.5, 1, 1],
  [DesignBlendMode.ColorBurn, 0.75, 0.5, 0.5],
  [DesignBlendMode.ColorBurn, 1, 0, 1],
  [DesignBlendMode.ColorBurn, 0.5, 0, 0],
  [DesignBlendMode.HardLight, 0.4, 0.75, 0.7],
  [DesignBlendMode.HardLight, 0.4, 0.25, 0.2],
  [DesignBlendMode.SoftLight, 0.5, 0.25, 0.375],
  [DesignBlendMode.SoftLight, 0.16, 0.75, 0.279168],
  [DesignBlendMode.SoftLight, 0.64, 0.75, 0.72],
  [DesignBlendMode.Difference, 0.2, 0.7, 0.5],
  [DesignBlendMode.Exclusion, 0.2, 0.7, 0.62],
];

describe("blendChannel", () => {
  it.each(separableCases)("%s b=%f s=%f", (mode, b, s, expected) => {
    expect(blendChannel(mode, b, s)).toBeCloseTo(expected, 6);
  });
});

describe("non-separable modes", () => {
  const out = new Float64Array(3);

  it("hue keeps the saturation and luminosity of the backdrop", () => {
    blendColors(DesignBlendMode.Hue, triple(0.2, 0.4, 0.6), triple(1, 0, 0), out);
    expect([...out]).toEqual([
      expect.closeTo(0.642, 6),
      expect.closeTo(0.242, 6),
      expect.closeTo(0.242, 6),
    ]);
  });

  it("saturation takes the saturation of the source", () => {
    blendColors(DesignBlendMode.Saturation, triple(0.2, 0.4, 0.6), triple(1, 0.5, 0.5), out);
    expect([...out]).toEqual([
      expect.closeTo(0.1595, 6),
      expect.closeTo(0.4095, 6),
      expect.closeTo(0.6595, 6),
    ]);
  });

  it("color takes hue and saturation of the source and clips", () => {
    blendColors(DesignBlendMode.Color, triple(0.5, 0.5, 0.5), triple(1, 0, 0), out);
    expect([...out]).toEqual([
      expect.closeTo(1, 6),
      expect.closeTo(0.285714, 5),
      expect.closeTo(0.285714, 5),
    ]);
  });

  it("luminosity takes the luminosity of the source and clips", () => {
    blendColors(DesignBlendMode.Luminosity, triple(1, 0, 0), triple(0, 0, 1), out);
    expect([...out]).toEqual([
      expect.closeTo(0.366667, 5),
      expect.closeTo(0, 6),
      expect.closeTo(0, 6),
    ]);
  });
});

describe("blendPixel", () => {
  it("normal at half opacity over opaque black", () => {
    expect(blendPixel(DesignBlendMode.Normal, [0, 0, 0, 255], [255, 255, 255, 255], 0.5)).toEqual([
      128, 128, 128, 255,
    ]);
  });

  it("multiply over an opaque backdrop", () => {
    expect(blendPixel(DesignBlendMode.Multiply, [255, 128, 0, 255], [128, 128, 128, 255])).toEqual([
      128, 64, 0, 255,
    ]);
  });

  it("any mode over a transparent backdrop returns the source", () => {
    expect(blendPixel(DesignBlendMode.Multiply, [0, 0, 0, 0], [200, 100, 50, 128])).toEqual([
      200, 100, 50, 128,
    ]);
  });

  it("composites partial alpha with the W3C formula", () => {
    const [r, g, b, a] = blendPixel(DesignBlendMode.Normal, [255, 0, 0, 128], [0, 0, 255, 128]);
    expect([r, g, b, a]).toEqual([85, 0, 170, 192]);
  });

  it("a transparent source changes nothing", () => {
    expect(blendPixel(DesignBlendMode.Screen, [10, 20, 30, 255], [255, 255, 255, 0])).toEqual([
      10, 20, 30, 255,
    ]);
  });
});

describe("blendOnto", () => {
  const solid = (w: number, h: number, r: number, g: number, b: number, a = 255) =>
    createPixelBuffer(w, h, { r, g, b, a });

  it("multiplies opacity and fill opacity", () => {
    const target = solid(1, 1, 0, 0, 0);
    blendOnto(target, solid(1, 1, 255, 255, 255), {
      mode: DesignBlendMode.Normal,
      opacity: 0.5,
      fillOpacity: 0.5,
    });
    expect(getPixel(target, 0, 0)).toEqual({ r: 64, g: 64, b: 64, a: 255 });
  });

  it("honors the mask and the clip coverage", () => {
    const target = solid(2, 1, 0, 0, 0);
    const mask = { width: 2, height: 1, data: Uint8Array.of(255, 0) };
    const clip = { width: 2, height: 1, data: Uint8Array.of(255, 255) };
    blendOnto(target, solid(2, 1, 255, 255, 255), { mode: DesignBlendMode.Normal, mask, clip });
    expect(getPixel(target, 0, 0).r).toBe(255);
    expect(getPixel(target, 1, 0).r).toBe(0);
  });

  it("places the source at an offset and clips to the target", () => {
    const target = solid(3, 3, 0, 0, 0);
    blendOnto(target, solid(2, 2, 255, 0, 0), { mode: DesignBlendMode.Normal, x: 2, y: -1 });
    expect(getPixel(target, 2, 0).r).toBe(255);
    expect(getPixel(target, 1, 0).r).toBe(0);
    expect(getPixel(target, 2, 1).r).toBe(0);
  });
});

describe("compositeLayers", () => {
  it("applies layers bottom first, so order matters", () => {
    const gray = createPixelBuffer(1, 1, { r: 128, g: 128, b: 128, a: 255 });
    const white = createPixelBuffer(1, 1, { r: 255, g: 255, b: 255, a: 255 });
    const a = createPixelBuffer(1, 1, { r: 0, g: 0, b: 0, a: 255 });
    const b = createPixelBuffer(1, 1, { r: 0, g: 0, b: 0, a: 255 });
    compositeLayers(a, [
      { source: gray, mode: DesignBlendMode.Normal },
      { source: gray, mode: DesignBlendMode.Multiply },
    ]);
    compositeLayers(b, [
      { source: gray, mode: DesignBlendMode.Multiply },
      { source: white, mode: DesignBlendMode.Normal },
    ]);
    expect(getPixel(a, 0, 0).r).toBe(64);
    expect(getPixel(b, 0, 0).r).toBe(255);
  });
});
