import { describe, expect, it } from "vitest";
import {
  adjustmentSchema,
  type AdjustmentParams,
} from "@/lib/shared/design/raster/adjustment-schemas";
import { AdjustmentType, type ChannelTarget } from "@/lib/shared/design/raster/adjustment-types";
import { brightnessContrastLut, curveLut } from "@/lib/shared/design/raster/adjustment-luts";
import { applyAdjustment, defaultAdjustment } from "@/lib/shared/design/raster/adjustments";
import { createPixelBuffer, getPixel, setPixel } from "@/lib/shared/design/raster/pixel-buffer";

const one = (r: number, g: number, b: number, a = 255) => createPixelBuffer(1, 1, { r, g, b, a });

const run = (params: AdjustmentParams, r: number, g: number, b: number, a = 255) =>
  getPixel(applyAdjustment(one(r, g, b, a), params), 0, 0);

const levels = (overrides: Partial<Record<ChannelTarget, object>>): AdjustmentParams => {
  const base = defaultAdjustment(AdjustmentType.Levels);
  if (base.type !== AdjustmentType.Levels) throw new Error("unexpected");
  return {
    type: AdjustmentType.Levels,
    channels: { ...base.channels, ...overrides } as typeof base.channels,
  };
};

const konva = (value: number, brightness: number, contrast: number): number => {
  const bright = Math.min(255, Math.max(0, Math.round(value + (brightness / 100) * 255)));
  const adjust = ((contrast + 100) / 100) ** 2;
  return Math.min(255, Math.max(0, ((bright / 255 - 0.5) * adjust + 0.5) * 255));
};

describe("brightness and contrast", () => {
  it("adds 255 * brightness / 100 and clamps", () => {
    const out = run(
      { type: AdjustmentType.BrightnessContrast, brightness: 20, contrast: 0 },
      10,
      100,
      220,
    );
    expect([out.r, out.g, out.b]).toEqual([61, 151, 255]);
  });

  it("matches the Konva Brighten and Contrast formulas within 1 level", () => {
    const cases: [number, number][] = [
      [0, 0],
      [30, 0],
      [-40, 0],
      [0, 50],
      [0, -50],
      [25, 80],
      [-60, -30],
      [100, 100],
    ];
    for (const [brightness, contrast] of cases) {
      const lut = brightnessContrastLut(brightness, contrast);
      for (let v = 0; v < 256; v += 1) {
        expect(Math.abs((lut[v] ?? 0) - konva(v, brightness, contrast))).toBeLessThanOrEqual(1);
      }
    }
  });

  it("full contrast pushes extremes to black and white and keeps alpha", () => {
    const out = run(
      { type: AdjustmentType.BrightnessContrast, brightness: 0, contrast: 100 },
      64,
      191,
      128,
      77,
    );
    expect([out.r, out.g, out.a]).toEqual([0, 255, 77]);
  });
});

describe("levels", () => {
  it("maps the input range to the full range", () => {
    const params = levels({
      rgb: { inputBlack: 50, inputWhite: 200, gamma: 1, outputBlack: 0, outputWhite: 255 },
    });
    expect(run(params, 50, 200, 125).r).toBe(0);
    expect(run(params, 50, 200, 125).g).toBe(255);
    expect(run(params, 50, 200, 125).b).toBe(128);
  });

  it("applies gamma", () => {
    const params = levels({
      rgb: { inputBlack: 0, inputWhite: 255, gamma: 2, outputBlack: 0, outputWhite: 255 },
    });
    expect(run(params, 128, 0, 0).r).toBe(181);
  });

  it("maps to the output range", () => {
    const params = levels({
      rgb: { inputBlack: 0, inputWhite: 255, gamma: 1, outputBlack: 10, outputWhite: 20 },
    });
    const out = run(params, 0, 255, 0);
    expect([out.r, out.g]).toEqual([10, 20]);
  });

  it("edits a single channel", () => {
    const params = levels({
      red: { inputBlack: 100, inputWhite: 255, gamma: 1, outputBlack: 0, outputWhite: 255 },
    });
    const out = run(params, 100, 100, 100);
    expect([out.r, out.g, out.b]).toEqual([0, 100, 100]);
  });
});

describe("curves", () => {
  const curves = (points: { x: number; y: number }[]): AdjustmentParams => {
    const base = defaultAdjustment(AdjustmentType.Curves);
    if (base.type !== AdjustmentType.Curves) throw new Error("unexpected");
    return { type: AdjustmentType.Curves, channels: { ...base.channels, rgb: points } };
  };

  it("passes through the control points", () => {
    const lut = curveLut([
      { x: 0, y: 0 },
      { x: 128, y: 200 },
      { x: 255, y: 255 },
    ]);
    expect([lut[0], lut[128], lut[255]]).toEqual([0, 200, 255]);
  });

  it("is monotone for monotone control points", () => {
    const lut = curveLut([
      { x: 0, y: 0 },
      { x: 30, y: 10 },
      { x: 60, y: 200 },
      { x: 128, y: 210 },
      { x: 255, y: 255 },
    ]);
    for (let i = 1; i < 256; i += 1) expect(lut[i] ?? 0).toBeGreaterThanOrEqual(lut[i - 1] ?? 0);
  });

  it("stays flat outside the end points", () => {
    const lut = curveLut([
      { x: 50, y: 100 },
      { x: 200, y: 150 },
    ]);
    expect([lut[0], lut[255]]).toEqual([100, 150]);
  });

  it("the identity curve changes nothing and a two point line inverts", () => {
    expect(
      run(
        curves([
          { x: 0, y: 0 },
          { x: 255, y: 255 },
        ]),
        12,
        99,
        250,
      ).g,
    ).toBe(99);
    const out = run(
      curves([
        { x: 0, y: 255 },
        { x: 255, y: 0 },
      ]),
      0,
      255,
      100,
    );
    expect([out.r, out.g, out.b]).toEqual([255, 0, 155]);
  });

  it("accepts sixteen control points", () => {
    const points = Array.from({ length: 16 }, (_, i) => ({ x: i * 17, y: i * 17 }));
    const lut = curveLut(points);
    expect(lut[100]).toBe(100);
  });
});

describe("hue, saturation and lightness", () => {
  const hsl = (hue: number, saturation: number, lightness: number): AdjustmentParams => ({
    type: AdjustmentType.HueSaturation,
    hue,
    saturation,
    lightness,
  });

  it("rotates the hue", () => {
    expect(run(hsl(120, 0, 0), 255, 0, 0)).toEqual({ r: 0, g: 255, b: 0, a: 255 });
    expect(run(hsl(180, 0, 0), 255, 0, 0)).toEqual({ r: 0, g: 255, b: 255, a: 255 });
    expect(run(hsl(-120, 0, 0), 255, 0, 0)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
  });

  it("removes saturation", () => {
    const out = run(hsl(0, -100, 0), 200, 100, 50);
    expect(out.r).toBe(out.g);
    expect(out.g).toBe(out.b);
    expect(Math.abs(out.r - 125)).toBeLessThanOrEqual(1);
  });

  it("goes to white and black at the lightness extremes", () => {
    expect(run(hsl(0, 0, 100), 200, 100, 50)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(run(hsl(0, 0, -100), 200, 100, 50)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });

  it("zero values are an identity within 1 level", () => {
    const out = run(hsl(0, 0, 0), 200, 100, 50);
    expect(
      Math.abs(out.r - 200) + Math.abs(out.g - 100) + Math.abs(out.b - 50),
    ).toBeLessThanOrEqual(3);
  });
});

describe("color balance", () => {
  const shift = (cyanRed: number, magentaGreen: number, yellowBlue: number) => ({
    cyanRed,
    magentaGreen,
    yellowBlue,
  });
  const zero = shift(0, 0, 0);

  it("shifts midtones toward red", () => {
    const out = run(
      {
        type: AdjustmentType.ColorBalance,
        shadows: zero,
        midtones: shift(100, 0, 0),
        highlights: zero,
        preserveLuminosity: false,
      },
      128,
      128,
      128,
    );
    expect(out.r).toBeGreaterThan(200);
    expect([out.g, out.b]).toEqual([128, 128]);
  });

  it("shadows only act on dark pixels", () => {
    const params: AdjustmentParams = {
      type: AdjustmentType.ColorBalance,
      shadows: shift(0, 0, 50),
      midtones: zero,
      highlights: zero,
      preserveLuminosity: false,
    };
    expect(run(params, 0, 0, 0).b).toBe(51);
    expect(run(params, 255, 255, 255).b).toBe(255);
  });

  it("the default is an identity", () => {
    const out = run(defaultAdjustment(AdjustmentType.ColorBalance), 90, 140, 200);
    expect([out.r, out.g, out.b]).toEqual([90, 140, 200]);
  });
});

describe("black and white, invert, threshold", () => {
  const bw = defaultAdjustment(AdjustmentType.BlackWhite);

  it("weights primaries by the hue sliders", () => {
    expect(run(bw, 255, 0, 0).r).toBe(102);
    expect(run(bw, 0, 255, 0).r).toBe(102);
    expect(run(bw, 255, 255, 0).r).toBe(153);
  });

  it("keeps neutral pixels and produces gray", () => {
    expect(run(bw, 255, 255, 255).r).toBe(255);
    const out = run(bw, 90, 90, 90);
    expect([out.r, out.g, out.b]).toEqual([90, 90, 90]);
  });

  it("inverts the color and keeps alpha, twice is an identity", () => {
    const inverted = run({ type: AdjustmentType.Invert }, 10, 20, 30, 40);
    expect(inverted).toEqual({ r: 245, g: 235, b: 225, a: 40 });
    const twice = applyAdjustment(
      applyAdjustment(one(10, 20, 30, 40), { type: AdjustmentType.Invert }),
      {
        type: AdjustmentType.Invert,
      },
    );
    expect(getPixel(twice, 0, 0)).toEqual({ r: 10, g: 20, b: 30, a: 40 });
  });

  it("thresholds by luma", () => {
    const params: AdjustmentParams = { type: AdjustmentType.Threshold, level: 128 };
    expect(run(params, 200, 200, 200).r).toBe(255);
    expect(run(params, 100, 100, 100).r).toBe(0);
    expect(run(params, 255, 0, 0).r).toBe(0);
  });

  it("does not mutate the input", () => {
    const input = one(1, 2, 3);
    applyAdjustment(input, { type: AdjustmentType.Invert });
    expect(getPixel(input, 0, 0)).toEqual({ r: 1, g: 2, b: 3, a: 255 });
  });
});

describe("adjustment schema", () => {
  it("parses the defaults of every type", () => {
    for (const type of Object.values(AdjustmentType)) {
      expect(adjustmentSchema.safeParse(defaultAdjustment(type)).success).toBe(true);
    }
  });

  it("clamps numbers instead of rejecting them", () => {
    const parsed = adjustmentSchema.parse({
      type: AdjustmentType.BrightnessContrast,
      brightness: 500,
      contrast: -500,
    });
    expect(parsed).toEqual({
      type: AdjustmentType.BrightnessContrast,
      brightness: 100,
      contrast: -100,
    });
  });

  it("rejects non-finite numbers and unknown types", () => {
    expect(
      adjustmentSchema.safeParse({ type: AdjustmentType.Threshold, level: Number.NaN }).success,
    ).toBe(false);
    expect(adjustmentSchema.safeParse({ type: "sepia" }).success).toBe(false);
  });

  it("limits curves to 16 increasing points", () => {
    const base = defaultAdjustment(AdjustmentType.Curves);
    if (base.type !== AdjustmentType.Curves) throw new Error("unexpected");
    const withPoints = (points: { x: number; y: number }[]) =>
      adjustmentSchema.safeParse({ ...base, channels: { ...base.channels, rgb: points } }).success;
    const make = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ x: i * 10, y: i * 10 }));
    expect(withPoints(make(16))).toBe(true);
    expect(withPoints(make(17))).toBe(false);
    expect(withPoints(make(1))).toBe(false);
    expect(
      withPoints([
        { x: 5, y: 0 },
        { x: 5, y: 9 },
      ]),
    ).toBe(false);
  });
});

describe("performance", () => {
  it("applies levels to a 1024x1024 buffer well under the bound", () => {
    const buffer = createPixelBuffer(1024, 1024, { r: 10, g: 120, b: 230, a: 255 });
    setPixel(buffer, 5, 5, { r: 0, g: 0, b: 0, a: 255 });
    const started = performance.now();
    const out = applyAdjustment(
      buffer,
      levels({
        rgb: { inputBlack: 20, inputWhite: 220, gamma: 1.2, outputBlack: 0, outputWhite: 255 },
      }),
    );
    expect(performance.now() - started).toBeLessThan(3000);
    expect(getPixel(out, 5, 5).r).toBe(0);
  });
});
