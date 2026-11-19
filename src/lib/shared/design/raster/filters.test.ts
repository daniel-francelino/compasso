import { describe, expect, it } from "vitest";
import { addNoise, gaussianBlur, pixelate, unsharpMask } from "@/lib/shared/design/raster/filters";
import { createSeededRandom } from "@/lib/shared/design/raster/numeric";
import { createPixelBuffer, getPixel, setPixel } from "@/lib/shared/design/raster/pixel-buffer";
import { tilesEqual } from "@/lib/shared/design/raster/tiles";

const dot = () => {
  const buffer = createPixelBuffer(21, 21, { r: 0, g: 0, b: 0, a: 255 });
  setPixel(buffer, 10, 10, { r: 255, g: 255, b: 255, a: 255 });
  return buffer;
};

const redSum = (buffer: { data: Uint8ClampedArray }): number => {
  let total = 0;
  for (let i = 0; i < buffer.data.length; i += 4) total += buffer.data[i] ?? 0;
  return total;
};

describe("gaussianBlur", () => {
  it("radius 0 is an identity and does not alias the input", () => {
    const input = dot();
    const out = gaussianBlur(input, 0);
    expect(out).not.toBe(input);
    expect(tilesEqual(out.data, input.data)).toBe(true);
  });

  it("keeps the energy of a single white pixel", () => {
    const out = gaussianBlur(dot(), 1.5);
    expect(Math.abs(redSum(out) - 255)).toBeLessThanOrEqual(12);
    expect(getPixel(out, 10, 10).r).toBeLessThan(255);
    expect(getPixel(out, 10, 10).r).toBeGreaterThan(getPixel(out, 12, 10).r);
    expect(getPixel(out, 9, 10).r).toBe(getPixel(out, 11, 10).r);
  });

  it("does not darken the colors at transparent edges", () => {
    const buffer = createPixelBuffer(5, 1);
    setPixel(buffer, 2, 0, { r: 200, g: 100, b: 50, a: 255 });
    const out = gaussianBlur(buffer, 1);
    const side = getPixel(out, 1, 0);
    expect(side.a).toBeGreaterThan(0);
    expect(Math.abs(side.r - 200)).toBeLessThanOrEqual(2);
  });

  it("leaves a flat image unchanged", () => {
    const flat = createPixelBuffer(8, 8, { r: 40, g: 80, b: 120, a: 255 });
    expect(tilesEqual(gaussianBlur(flat, 2).data, flat.data)).toBe(true);
  });

  it("blurs 256x256 under the bound", () => {
    const big = createPixelBuffer(256, 256, { r: 10, g: 200, b: 90, a: 255 });
    const started = performance.now();
    gaussianBlur(big, 2);
    expect(performance.now() - started).toBeLessThan(3000);
  }, 30000);
});

describe("unsharpMask", () => {
  it("is an identity for amount 0 and for a flat image", () => {
    const input = dot();
    expect(
      tilesEqual(unsharpMask(input, { amount: 0, radius: 2, threshold: 0 }).data, input.data),
    ).toBe(true);
    const flat = createPixelBuffer(6, 6, { r: 90, g: 90, b: 90, a: 255 });
    expect(
      tilesEqual(unsharpMask(flat, { amount: 300, radius: 2, threshold: 0 }).data, flat.data),
    ).toBe(true);
  });

  it("overshoots an edge and honors the threshold", () => {
    const edge = createPixelBuffer(10, 1, { r: 100, g: 100, b: 100, a: 255 });
    for (let x = 5; x < 10; x += 1) setPixel(edge, x, 0, { r: 150, g: 150, b: 150, a: 255 });
    const sharp = unsharpMask(edge, { amount: 200, radius: 1, threshold: 0 });
    expect(getPixel(sharp, 4, 0).r).toBeLessThan(100);
    expect(getPixel(sharp, 5, 0).r).toBeGreaterThan(150);
    const gated = unsharpMask(edge, { amount: 200, radius: 1, threshold: 200 });
    expect(tilesEqual(gated.data, edge.data)).toBe(true);
  });
});

describe("addNoise", () => {
  const base = () => createPixelBuffer(16, 16, { r: 128, g: 128, b: 128, a: 255 });

  it("is deterministic for a seed and different across seeds", () => {
    const params = { amount: 20, monochrome: false };
    const a = addNoise(base(), params, createSeededRandom(7));
    const b = addNoise(base(), params, createSeededRandom(7));
    const c = addNoise(base(), params, createSeededRandom(8));
    expect(tilesEqual(a.data, b.data)).toBe(true);
    expect(tilesEqual(a.data, c.data)).toBe(false);
  });

  it("amount 0 is an identity and monochrome keeps gray", () => {
    expect(
      tilesEqual(
        addNoise(base(), { amount: 0, monochrome: false }, createSeededRandom(1)).data,
        base().data,
      ),
    ).toBe(true);
    const mono = addNoise(base(), { amount: 50, monochrome: true }, createSeededRandom(1));
    const p = getPixel(mono, 3, 3);
    expect(p.r).toBe(p.g);
    expect(p.g).toBe(p.b);
  });

  it("stays within the amount, keeps alpha and skips transparent pixels", () => {
    const buffer = base();
    setPixel(buffer, 0, 0, { r: 0, g: 0, b: 0, a: 0 });
    const out = addNoise(buffer, { amount: 10, monochrome: false }, createSeededRandom(3));
    expect(getPixel(out, 0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    for (let i = 4; i < out.data.length; i += 4) {
      expect(Math.abs((out.data[i] ?? 0) - 128)).toBeLessThanOrEqual(26);
      expect(out.data[i + 3]).toBe(255);
    }
  });

  it("the seeded generator stays in [0, 1)", () => {
    const random = createSeededRandom(42);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("pixelate", () => {
  it("cell 1 is an identity", () => {
    const input = dot();
    expect(tilesEqual(pixelate(input, 1).data, input.data)).toBe(true);
  });

  it("averages each cell, including partial edge cells", () => {
    const buffer = createPixelBuffer(3, 2, { r: 0, g: 0, b: 0, a: 255 });
    setPixel(buffer, 0, 0, { r: 200, g: 200, b: 200, a: 255 });
    setPixel(buffer, 1, 1, { r: 100, g: 100, b: 100, a: 255 });
    const out = pixelate(buffer, 2);
    expect(getPixel(out, 0, 0).r).toBe(75);
    expect(getPixel(out, 1, 1).r).toBe(75);
    expect(getPixel(out, 2, 0).r).toBe(0);
    expect(getPixel(out, 2, 1).a).toBe(255);
  });
});
