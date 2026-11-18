import { describe, expect, it } from "vitest";
import {
  beginStroke,
  dabAlpha,
  finishStroke,
  paintStroke,
  stabilize,
  stampDab,
  strokeBetween,
  strokeTiles,
  type BrushParams,
} from "@/lib/shared/design/raster/brush";
import {
  clonePixelBuffer,
  createPixelBuffer,
  getPixel,
} from "@/lib/shared/design/raster/pixel-buffer";
import { createMask } from "@/lib/shared/design/raster/selection";
import { tilesEqual } from "@/lib/shared/design/raster/tiles";

const params = (overrides: Partial<BrushParams> = {}): BrushParams => ({
  size: 5,
  hardness: 1,
  opacity: 1,
  flow: 1,
  color: { r: 10, g: 20, b: 30 },
  erase: false,
  ...overrides,
});

describe("dab falloff", () => {
  it("is solid inside and anti-aliased at the edge for a hard brush", () => {
    expect(dabAlpha(0, 2.5, 1)).toBe(1);
    expect(dabAlpha(2.5, 2.5, 1)).toBeCloseTo(0.5, 6);
    expect(dabAlpha(3, 2.5, 1)).toBe(0);
  });

  it("falls off linearly for a soft brush", () => {
    expect(dabAlpha(0, 10, 0)).toBe(1);
    expect(dabAlpha(5, 10, 0)).toBeCloseTo(0.55, 6);
    expect(dabAlpha(5, 10, 0.5)).toBe(1);
  });
});

describe("stampDab", () => {
  it("paints a hard round dab", () => {
    const buffer = createPixelBuffer(5, 5);
    stampDab(buffer, 2.5, 2.5, params());
    expect(getPixel(buffer, 2, 2)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
    expect(getPixel(buffer, 2, 0).a).toBe(255);
    expect(getPixel(buffer, 0, 0).a).toBeLessThan(60);
  });

  it("a soft brush is lighter than a hard one away from the center", () => {
    const hard = createPixelBuffer(21, 21);
    const soft = createPixelBuffer(21, 21);
    stampDab(hard, 10.5, 10.5, params({ size: 20, hardness: 1 }));
    stampDab(soft, 10.5, 10.5, params({ size: 20, hardness: 0 }));
    expect(getPixel(hard, 18, 10).a).toBe(255);
    expect(getPixel(soft, 18, 10).a).toBeLessThan(100);
    for (let x = 10; x < 20; x += 1) {
      expect(getPixel(soft, x + 1, 10).a).toBeLessThanOrEqual(getPixel(soft, x, 10).a);
    }
  });

  it("applies opacity and keeps the color of a single dab", () => {
    const buffer = createPixelBuffer(5, 5);
    stampDab(buffer, 2.5, 2.5, params({ opacity: 0.5 }));
    expect(getPixel(buffer, 2, 2)).toEqual({ r: 10, g: 20, b: 30, a: 128 });
  });

  it("accumulates flow over repeated dabs without a stroke", () => {
    const buffer = createPixelBuffer(5, 5);
    stampDab(buffer, 2.5, 2.5, params({ flow: 0.5 }));
    expect(getPixel(buffer, 2, 2).a).toBe(128);
    stampDab(buffer, 2.5, 2.5, params({ flow: 0.5 }));
    expect(Math.abs(getPixel(buffer, 2, 2).a - 191)).toBeLessThanOrEqual(1);
  });

  it("caps a recorded stroke at its opacity", () => {
    const buffer = createPixelBuffer(5, 5);
    const stroke = beginStroke(buffer);
    for (let i = 0; i < 20; i += 1) {
      stampDab(buffer, 2.5, 2.5, params({ opacity: 0.5, flow: 0.5 }), stroke);
    }
    const alpha = getPixel(buffer, 2, 2).a;
    expect(alpha).toBeLessThanOrEqual(128);
    expect(alpha).toBeGreaterThan(120);
  });

  it("blends over existing pixels", () => {
    const buffer = createPixelBuffer(5, 5, { r: 255, g: 0, b: 0, a: 255 });
    stampDab(buffer, 2.5, 2.5, params({ opacity: 0.5, color: { r: 0, g: 0, b: 255 } }));
    const pixel = getPixel(buffer, 2, 2);
    expect(pixel.a).toBe(255);
    expect(Math.abs(pixel.r - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs(pixel.b - 128)).toBeLessThanOrEqual(1);
  });

  it("erases alpha and keeps the color", () => {
    const buffer = createPixelBuffer(5, 5, { r: 9, g: 8, b: 7, a: 255 });
    stampDab(buffer, 2.5, 2.5, params({ erase: true }));
    expect(getPixel(buffer, 2, 2)).toEqual({ r: 9, g: 8, b: 7, a: 0 });
    const half = createPixelBuffer(5, 5, { r: 9, g: 8, b: 7, a: 255 });
    stampDab(half, 2.5, 2.5, params({ erase: true, opacity: 0.5 }));
    expect(getPixel(half, 2, 2).a).toBe(128);
  });

  it("respects the selection and the extra mask", () => {
    const selection = createMask(5, 5, 255);
    selection.data[2 * 5 + 2] = 0;
    const mask = createMask(5, 5, 255);
    mask.data[2 * 5 + 1] = 0;
    const buffer = createPixelBuffer(5, 5);
    stampDab(buffer, 2.5, 2.5, params({ selection, mask }));
    expect(getPixel(buffer, 2, 2).a).toBe(0);
    expect(getPixel(buffer, 1, 2).a).toBe(0);
    expect(getPixel(buffer, 3, 2).a).toBe(255);
  });

  it("ignores empty or outside dabs", () => {
    const buffer = createPixelBuffer(5, 5);
    stampDab(buffer, 2.5, 2.5, params({ size: 0 }));
    stampDab(buffer, 50, 50, params());
    expect(buffer.data.every((value) => value === 0)).toBe(true);
  });
});

describe("stroke recording", () => {
  it("records the touched tiles with their original pixels", () => {
    const buffer = createPixelBuffer(600, 300);
    const original = clonePixelBuffer(buffer);
    const stroke = beginStroke(buffer);
    stampDab(buffer, 255, 100, params({ size: 20 }), stroke);
    expect(strokeTiles(stroke)).toHaveLength(2);
    stampDab(buffer, 520, 280, params({ size: 20 }), stroke);
    expect(strokeTiles(stroke)).toHaveLength(4);
    const patch = finishStroke(stroke);
    expect(patch.tiles.length).toBeGreaterThan(0);
    expect(tilesEqual(buffer.data, original.data)).toBe(false);
    for (const tile of patch.tiles) expect(tile.before.every((value) => value === 0)).toBe(true);
  });

  it("paints a polyline stroke and returns the carry", () => {
    const buffer = createPixelBuffer(20, 5);
    const stroke = beginStroke(buffer);
    const line = [
      { x: 1, y: 2.5 },
      { x: 18, y: 2.5 },
    ];
    const carry = paintStroke(stroke, line, params({ size: 3 }), 25);
    expect(carry).toBeGreaterThanOrEqual(0);
    expect(getPixel(buffer, 10, 2).a).toBe(255);
    expect(getPixel(buffer, 10, 0).a).toBe(0);
  });
});

describe("strokeBetween", () => {
  const along = (from: number, to: number) => [
    { x: from, y: 0 },
    { x: to, y: 0 },
  ];

  it("places dabs at the spacing including the first point", () => {
    const { dabs, carry } = strokeBetween(along(0, 10), 10, 25);
    expect(dabs.map((dab) => dab.x)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(carry).toBe(0);
  });

  it("continues across calls with the carry", () => {
    const first = strokeBetween(along(0, 6), 10, 25);
    expect(first.dabs.map((dab) => dab.x)).toEqual([0, 2.5, 5]);
    expect(first.carry).toBeCloseTo(1, 9);
    const second = strokeBetween(along(6, 10), 10, 25, first.carry);
    expect(second.dabs.map((dab) => dab.x)).toEqual([7.5, 10]);
  });

  it("handles one point, repeated points and the minimum spacing", () => {
    expect(strokeBetween([{ x: 3, y: 4 }], 10, 25).dabs).toEqual([{ x: 3, y: 4 }]);
    const same = [
      { x: 3, y: 4 },
      { x: 3, y: 4 },
    ];
    expect(strokeBetween(same, 10, 25).dabs).toEqual([]);
    const tiny = strokeBetween(along(0, 3), 1, 10);
    expect(tiny.dabs.map((dab) => dab.x)).toEqual([0, 1, 2, 3]);
  });
});

describe("stabilize", () => {
  it("does not move inside the rope radius", () => {
    expect(stabilize({ x: 0, y: 0 }, { x: 3, y: 0 }, 4)).toEqual({ x: 0, y: 0 });
  });

  it("is pulled along the line keeping the rope length", () => {
    expect(stabilize({ x: 0, y: 0 }, { x: 10, y: 0 }, 4)).toEqual({ x: 6, y: 0 });
    const diagonal = stabilize({ x: 0, y: 0 }, { x: 6, y: 8 }, 5);
    expect(diagonal.x).toBeCloseTo(3, 9);
    expect(diagonal.y).toBeCloseTo(4, 9);
  });

  it("radius 0 follows the pointer exactly", () => {
    expect(stabilize({ x: 1, y: 1 }, { x: 5, y: 7 }, 0)).toEqual({ x: 5, y: 7 });
  });
});
