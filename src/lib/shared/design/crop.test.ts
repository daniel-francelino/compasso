import { describe, expect, it } from "vitest";
import {
  CropHandle,
  CropRatio,
  cropPage,
  dragCrop,
  fullCrop,
  hitCrop,
  isFullCrop,
  isValidCrop,
  newCrop,
  pageSizeOf,
  ratioValue,
} from "@/lib/shared/design/crop";
import {
  createRasterLayer,
  createShape,
  emptyPage,
  addElement,
} from "@/lib/shared/design/document";
import { DesignElementKind, DesignPreset } from "@/lib/shared/design/types";

const PALETTE = { ink: "#111111", surface: "#ffffff", accent: "#ff0000" };
const BOUNDS = { width: 1000, height: 800 };

describe("pageSizeOf", () => {
  it("uses the preset until the page has its own size", () => {
    const page = emptyPage("p");
    expect(pageSizeOf(page, DesignPreset.FeedSquare)).toEqual({ width: 1080, height: 1080 });
    expect(pageSizeOf({ ...page, width: 500, height: 300 }, DesignPreset.Story)).toEqual({
      width: 500,
      height: 300,
    });
  });
});

describe("ratios", () => {
  it("computes the ratio value", () => {
    expect(ratioValue(CropRatio.Free, BOUNDS)).toBeNull();
    expect(ratioValue(CropRatio.Square, BOUNDS)).toBe(1);
    expect(ratioValue(CropRatio.Original, BOUNDS)).toBe(1.25);
    expect(ratioValue(CropRatio.Story, BOUNDS)).toBeCloseTo(0.5625);
  });
});

describe("crop box", () => {
  it("starts as the whole page and validates the limits", () => {
    const box = fullCrop(BOUNDS);
    expect(isFullCrop(box, BOUNDS)).toBe(true);
    expect(isValidCrop(box)).toBe(true);
    expect(isValidCrop({ x: 0, y: 0, width: 63, height: 200 })).toBe(false);
    expect(isValidCrop({ x: 0, y: 0, width: 5000, height: 200 })).toBe(false);
  });

  it("hits handles first, then the inside", () => {
    const box = { x: 100, y: 100, width: 400, height: 300 };
    expect(hitCrop(box, { x: 101, y: 99 }, 1, false)).toBe(CropHandle.NorthWest);
    expect(hitCrop(box, { x: 300, y: 101 }, 1, false)).toBe(CropHandle.North);
    expect(hitCrop(box, { x: 300, y: 101 }, 1, true)).toBe(CropHandle.Move);
    expect(hitCrop(box, { x: 300, y: 250 }, 1, false)).toBe(CropHandle.Move);
    expect(hitCrop(box, { x: 700, y: 700 }, 1, false)).toBeNull();
  });

  it("draws a new box from any direction and keeps it inside the page", () => {
    expect(newCrop({ x: 100, y: 100 }, { x: 300, y: 250 }, null, BOUNDS)).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    });
    expect(newCrop({ x: 300, y: 250 }, { x: 100, y: 100 }, null, BOUNDS)).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    });
    const outside = newCrop({ x: 900, y: 700 }, { x: 5000, y: 5000 }, null, BOUNDS);
    expect(outside).toEqual({ x: 900, y: 700, width: 100, height: 100 });
  });

  it("keeps a fixed ratio while drawing and resizing", () => {
    const drawn = newCrop({ x: 0, y: 0 }, { x: 400, y: 100 }, 1, BOUNDS);
    expect(drawn.width).toBe(drawn.height);
    const box = { x: 100, y: 100, width: 300, height: 300 };
    const resized = dragCrop(
      box,
      CropHandle.SouthEast,
      { x: 400, y: 400 },
      { x: 700, y: 500 },
      1,
      BOUNDS,
    );
    expect(resized).toEqual({ x: 100, y: 100, width: 600, height: 600 });
    const limited = dragCrop(
      box,
      CropHandle.SouthEast,
      { x: 400, y: 400 },
      { x: 990, y: 790 },
      1,
      BOUNDS,
    );
    expect(limited.width).toBe(700);
    expect(limited.height).toBe(700);
  });

  it("moves inside the page and resizes by an edge", () => {
    const box = { x: 100, y: 100, width: 400, height: 300 };
    expect(
      dragCrop(box, CropHandle.Move, { x: 200, y: 200 }, { x: -500, y: 2000 }, null, BOUNDS),
    ).toEqual({
      x: 0,
      y: 500,
      width: 400,
      height: 300,
    });
    expect(
      dragCrop(box, CropHandle.West, { x: 100, y: 200 }, { x: 40, y: 200 }, null, BOUNDS),
    ).toEqual({
      x: 40,
      y: 100,
      width: 460,
      height: 300,
    });
    expect(
      dragCrop(box, CropHandle.South, { x: 200, y: 400 }, { x: 200, y: 99999 }, null, BOUNDS),
    ).toEqual({
      x: 100,
      y: 100,
      width: 400,
      height: 700,
    });
  });
});

describe("cropPage", () => {
  it("sets the page size and shifts every element", () => {
    const shape = createShape("a", DesignElementKind.Rect, DesignPreset.FeedSquare, PALETTE);
    const layer = createRasterLayer("b", emptyPage("p"), { width: 1080, height: 1080 });
    let page = addElement(emptyPage("p"), { ...shape, x: 300, y: 200 });
    page = addElement(page, layer);
    const cropped = cropPage(page, { x: 100, y: 50, width: 640, height: 480 });
    expect(cropped.width).toBe(640);
    expect(cropped.height).toBe(480);
    expect(cropped.elements.map((element) => [element.x, element.y])).toEqual([
      [200, 150],
      [-100, -50],
    ]);
    expect(cropped.elements[1]?.width).toBe(1080);
  });
});
