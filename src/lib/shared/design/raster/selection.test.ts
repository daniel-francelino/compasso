import { describe, expect, it } from "vitest";
import { createPixelBuffer, setPixel } from "@/lib/shared/design/raster/pixel-buffer";
import {
  SelectionCombine,
  combineMasks,
  createMask,
  ellipseMask,
  featherMask,
  growMask,
  invertMask,
  magicWand,
  maskBoundingBox,
  maskOutline,
  polygonMask,
  rectMask,
  shrinkMask,
  type SelectionMask,
} from "@/lib/shared/design/raster/selection";

const sum = (mask: SelectionMask): number => mask.data.reduce((total, value) => total + value, 0);
const count = (mask: SelectionMask): number => mask.data.filter((value) => value > 0).length;
const valueAt = (mask: SelectionMask, x: number, y: number): number =>
  mask.data[y * mask.width + x] ?? 0;

describe("shape masks", () => {
  it("selects the whole pixels of an integer rect", () => {
    const mask = rectMask(4, 4, { x: 1, y: 1, width: 2, height: 2 });
    expect(count(mask)).toBe(4);
    expect(valueAt(mask, 1, 1)).toBe(255);
    expect(valueAt(mask, 0, 0)).toBe(0);
  });

  it("anti-aliases fractional rect edges and clips to the canvas", () => {
    const mask = rectMask(3, 1, { x: 0.5, y: 0, width: 1, height: 1 });
    expect([valueAt(mask, 0, 0), valueAt(mask, 1, 0), valueAt(mask, 2, 0)]).toEqual([128, 128, 0]);
    expect(count(rectMask(3, 3, { x: -5, y: -5, width: 100, height: 100 }))).toBe(9);
  });

  it("draws a symmetric anti-aliased ellipse with the right area", () => {
    const mask = ellipseMask(20, 20, { x: 0, y: 0, width: 20, height: 20 });
    expect(valueAt(mask, 10, 10)).toBe(255);
    expect(valueAt(mask, 0, 0)).toBe(0);
    expect(valueAt(mask, 5, 10)).toBe(valueAt(mask, 14, 10));
    expect(valueAt(mask, 10, 5)).toBe(valueAt(mask, 10, 14));
    expect(Math.abs(sum(mask) / 255 - Math.PI * 100)).toBeLessThan(4);
    const partial = mask.data.filter((value) => value > 0 && value < 255).length;
    expect(partial).toBeGreaterThan(10);
  });

  it("an empty ellipse selects nothing", () => {
    expect(count(ellipseMask(5, 5, { x: 1, y: 1, width: 0, height: 3 }))).toBe(0);
  });

  it("fills a polygon with the scanline rule", () => {
    const square = polygonMask(6, 6, [
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 4 },
      { x: 1, y: 4 },
    ]);
    expect(count(square)).toBe(9);
    const triangle = polygonMask(8, 8, [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 0, y: 8 },
    ]);
    expect(count(triangle)).toBe(28);
    expect(
      count(
        polygonMask(8, 8, [
          { x: 0, y: 0 },
          { x: 4, y: 4 },
        ]),
      ),
    ).toBe(0);
  });

  it("leaves the hole of a concave polygon unselected (even-odd)", () => {
    const u = polygonMask(9, 5, [
      { x: 0, y: 0 },
      { x: 9, y: 0 },
      { x: 9, y: 5 },
      { x: 6, y: 5 },
      { x: 6, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 5 },
      { x: 0, y: 5 },
    ]);
    expect(valueAt(u, 4, 3)).toBe(0);
    expect(valueAt(u, 1, 3)).toBe(255);
    expect(valueAt(u, 4, 1)).toBe(255);
  });
});

describe("magic wand", () => {
  const striped = () => {
    const buffer = createPixelBuffer(5, 5, { r: 255, g: 255, b: 255, a: 255 });
    for (let y = 0; y < 5; y += 1) setPixel(buffer, 2, y, { r: 0, g: 0, b: 0, a: 255 });
    return buffer;
  };

  it("fills only the connected region", () => {
    const mask = magicWand(striped(), 0, 0, { tolerance: 0, contiguous: true });
    expect(count(mask)).toBe(10);
    expect(valueAt(mask, 3, 0)).toBe(0);
  });

  it("selects every matching pixel when not contiguous", () => {
    expect(count(magicWand(striped(), 0, 0, { tolerance: 0, contiguous: false }))).toBe(20);
  });

  it("honors the tolerance as the largest channel difference", () => {
    const buffer = createPixelBuffer(2, 1, { r: 100, g: 100, b: 100, a: 255 });
    setPixel(buffer, 1, 0, { r: 110, g: 100, b: 100, a: 255 });
    expect(count(magicWand(buffer, 0, 0, { tolerance: 9, contiguous: true }))).toBe(1);
    expect(count(magicWand(buffer, 0, 0, { tolerance: 10, contiguous: true }))).toBe(2);
  });

  it("compares alpha and handles spirals and outside seeds", () => {
    const buffer = createPixelBuffer(3, 1, { r: 5, g: 5, b: 5, a: 255 });
    setPixel(buffer, 2, 0, { r: 5, g: 5, b: 5, a: 0 });
    expect(count(magicWand(buffer, 0, 0, { tolerance: 0, contiguous: false }))).toBe(2);
    expect(count(magicWand(buffer, 9, 9, { tolerance: 0, contiguous: true }))).toBe(0);
    const spiral = createPixelBuffer(5, 5, { r: 0, g: 0, b: 0, a: 255 });
    for (const [x, y] of [
      [1, 1],
      [2, 1],
      [3, 1],
      [3, 2],
      [3, 3],
      [2, 3],
      [1, 3],
      [1, 2],
    ] as const) {
      setPixel(spiral, x, y, { r: 255, g: 255, b: 255, a: 255 });
    }
    expect(count(magicWand(spiral, 1, 1, { tolerance: 0, contiguous: true }))).toBe(8);
  });
});

describe("mask operations", () => {
  const a = createMask(2, 1);
  a.data.set([200, 100]);
  const b = createMask(2, 1);
  b.data.set([100, 255]);

  it("combines in the four modes", () => {
    expect([...combineMasks(a, b, SelectionCombine.Replace).data]).toEqual([100, 255]);
    expect([...combineMasks(a, b, SelectionCombine.Add).data]).toEqual([222, 255]);
    expect([...combineMasks(a, b, SelectionCombine.Subtract).data]).toEqual([122, 0]);
    expect([...combineMasks(a, b, SelectionCombine.Intersect).data]).toEqual([78, 100]);
  });

  it("inverts twice to the original", () => {
    expect([...invertMask(a).data]).toEqual([55, 155]);
    expect([...invertMask(invertMask(a)).data]).toEqual([200, 100]);
  });

  it("finds the bounding box", () => {
    const mask = rectMask(10, 10, { x: 2, y: 3, width: 4, height: 2 });
    expect(maskBoundingBox(mask)).toEqual({ x: 2, y: 3, width: 4, height: 2 });
    expect(maskBoundingBox(createMask(4, 4))).toBeNull();
  });

  it("grows a pixel into a square and shrinks it back", () => {
    const dot = createMask(11, 11);
    dot.data[5 * 11 + 5] = 255;
    const grown = growMask(dot, 2);
    expect(count(grown)).toBe(25);
    expect(maskBoundingBox(grown)).toEqual({ x: 3, y: 3, width: 5, height: 5 });
    const back = shrinkMask(grown, 2);
    expect(count(back)).toBe(1);
    expect(valueAt(back, 5, 5)).toBe(255);
    expect(count(growMask(dot, 0))).toBe(1);
  });

  it("grows against the canvas border", () => {
    const corner = createMask(5, 5);
    corner.data[0] = 255;
    expect(count(growMask(corner, 1))).toBe(4);
  });
});

describe("feather", () => {
  const block = () => rectMask(41, 41, { x: 13, y: 13, width: 15, height: 15 });

  it("radius 0 is an identity", () => {
    expect([...featherMask(block(), 0).data]).toEqual([...block().data]);
  });

  it("softens the edge, keeps the energy and the core", () => {
    const soft = featherMask(block(), 4);
    expect(Math.abs(sum(soft) - sum(block())) / sum(block())).toBeLessThan(0.01);
    expect(valueAt(soft, 20, 20)).toBe(255);
    expect(valueAt(soft, 0, 0)).toBe(0);
    expect(valueAt(soft, 11, 20)).toBeGreaterThan(0);
    expect(valueAt(soft, 13, 20)).toBeLessThan(255);
    for (let x = 6; x < 20; x += 1) {
      expect(valueAt(soft, x + 1, 20)).toBeGreaterThanOrEqual(valueAt(soft, x, 20));
    }
  });
});

describe("outline", () => {
  it("lists the four sides of a square with merged runs", () => {
    const outline = maskOutline(rectMask(4, 4, { x: 1, y: 1, width: 2, height: 2 }));
    expect(outline.truncated).toBe(false);
    expect(outline.segments).toHaveLength(4);
    expect(outline.segments).toContainEqual({ x1: 1, y1: 1, x2: 3, y2: 1 });
    expect(outline.segments).toContainEqual({ x1: 3, y1: 1, x2: 3, y2: 3 });
  });

  it("draws the canvas border for a full mask and nothing for an empty one", () => {
    expect(maskOutline(createMask(3, 3, 255)).segments).toHaveLength(4);
    expect(maskOutline(createMask(3, 3)).segments).toHaveLength(0);
  });

  it("is bounded", () => {
    const checker = createMask(10, 10);
    for (let i = 0; i < 100; i += 1) checker.data[i] = (i + Math.floor(i / 10)) % 2 === 0 ? 255 : 0;
    const outline = maskOutline(checker, 5);
    expect(outline.segments).toHaveLength(5);
    expect(outline.truncated).toBe(true);
  });
});
