import { describe, expect, it } from "vitest";
import {
  centerPlacement,
  copyRegion,
  exceedsRasterSide,
  fittedPlacement,
  pasteCenter,
  pastedLayer,
  regionPlacement,
  systemMatches,
} from "@/lib/shared/design/pixel-clipboard";
import { emptyPage } from "@/lib/shared/design/document";
import { createPixelBuffer, setPixel } from "@/lib/shared/design/raster/pixel-buffer";
import { createMask, rectMask } from "@/lib/shared/design/raster/selection";

const RED = { r: 200, g: 10, b: 10, a: 255 };

describe("copyRegion", () => {
  it("copies the whole layer without a selection", () => {
    const source = createPixelBuffer(4, 3, RED);
    const copied = copyRegion(source, null);
    expect(copied?.region).toEqual({ x: 0, y: 0, width: 4, height: 3 });
    expect(Array.from(copied?.buffer.data ?? [])).toEqual(Array.from(source.data));
  });

  it("copies the bounding box and keeps unselected pixels transparent", () => {
    const source = createPixelBuffer(6, 6, RED);
    const mask = rectMask(6, 6, { x: 2, y: 1, width: 3, height: 2 });
    mask.data[1 * 6 + 2] = 0;
    const copied = copyRegion(source, mask);
    expect(copied?.region).toEqual({ x: 2, y: 1, width: 3, height: 2 });
    expect(copied?.buffer.width).toBe(3);
    expect(copied?.buffer.data[3]).toBe(0);
    expect(copied?.buffer.data[7]).toBe(255);
  });

  it("scales the alpha by a soft selection", () => {
    const source = createPixelBuffer(2, 1, RED);
    const mask = createMask(2, 1);
    mask.data[0] = 128;
    mask.data[1] = 255;
    const copied = copyRegion(source, mask);
    expect(copied?.buffer.data[3]).toBe(128);
    expect(copied?.buffer.data[7]).toBe(255);
  });

  it("returns null for an empty selection", () => {
    expect(copyRegion(createPixelBuffer(4, 4, RED), createMask(4, 4))).toBeNull();
  });

  it("keeps the pixel values of the chosen region", () => {
    const source = createPixelBuffer(4, 4);
    setPixel(source, 2, 2, RED);
    const copied = copyRegion(source, rectMask(4, 4, { x: 2, y: 2, width: 1, height: 1 }));
    expect(Array.from(copied?.buffer.data ?? [])).toEqual([200, 10, 10, 255]);
  });
});

describe("placement", () => {
  const layer = {
    x: 100,
    y: 50,
    width: 200,
    height: 100,
    rotation: 0,
    pixelWidth: 100,
    pixelHeight: 50,
  };

  it("maps a region to the document through scale", () => {
    const placement = regionPlacement(layer, { x: 10, y: 20, width: 30, height: 10 });
    expect(placement).toEqual({ x: 120, y: 90, width: 60, height: 20, rotation: 0 });
  });

  it("keeps the center of the region under a half-turn rotation", () => {
    const placement = regionPlacement(
      { ...layer, rotation: 180 },
      { x: 0, y: 0, width: 50, height: 50 },
    );
    expect(placement.x + placement.width / 2).toBeCloseTo(250, 1);
    expect(placement.y + placement.height / 2).toBeCloseTo(100, 1);
    expect(placement.rotation).toBe(180);
  });

  it("centers a placement and fits system images inside the page", () => {
    const moved = centerPlacement(
      { x: 0, y: 0, width: 100, height: 40, rotation: 0 },
      { x: 500, y: 300 },
    );
    expect(moved).toMatchObject({ x: 450, y: 280 });
    const fitted = fittedPlacement({ width: 2000, height: 1000 }, { width: 1000, height: 1000 });
    expect(fitted).toEqual({ x: 0, y: 250, width: 1000, height: 500, rotation: 0 });
    expect(fittedPlacement({ width: 100, height: 100 }, { width: 1000, height: 1000 }).width).toBe(
      100,
    );
  });

  it("pastes at the center of the selection or of the page", () => {
    expect(pasteCenter({ width: 1000, height: 800 }, null)).toEqual({ x: 500, y: 400 });
    const mask = rectMask(1000, 800, { x: 100, y: 100, width: 200, height: 100 });
    expect(pasteCenter({ width: 1000, height: 800 }, mask)).toEqual({ x: 200, y: 150 });
  });
});

describe("pasted layer", () => {
  it("builds a raster layer with the clip pixel size", () => {
    const placement = { x: 5, y: 6, width: 60, height: 40, rotation: 0 };
    const layer = pastedLayer(
      "a",
      emptyPage("p"),
      { width: 1080, height: 1080 },
      createPixelBuffer(30, 20),
      placement,
    );
    expect(layer).toMatchObject({
      x: 5,
      y: 6,
      width: 60,
      height: 40,
      pixelWidth: 30,
      pixelHeight: 20,
    });
    expect(layer.pixelsVersionId).toBeNull();
  });

  it("detects oversize pixels and matches the system clipboard by size", () => {
    expect(exceedsRasterSide(createPixelBuffer(4097, 1))).toBe(true);
    expect(exceedsRasterSide(createPixelBuffer(10, 10))).toBe(false);
    const clip = {
      buffer: createPixelBuffer(1, 1),
      placement: { x: 0, y: 0, width: 1, height: 1, rotation: 0 },
      systemBytes: 42,
    };
    expect(systemMatches(clip, 42)).toBe(true);
    expect(systemMatches(clip, 7)).toBe(false);
    expect(systemMatches(null, 42)).toBe(false);
  });
});
