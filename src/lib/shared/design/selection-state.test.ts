import { describe, expect, it } from "vitest";
import { beginStroke, finishStroke, paintStroke } from "@/lib/shared/design/raster/brush";
import { createPixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import { SelectionCombine, rectMask } from "@/lib/shared/design/raster/selection";
import {
  MarqueeShape,
  applySelection,
  growSelection,
  invertSelection,
  layerToPageBuffer,
  marqueeRect,
  modeFromModifiers,
  selectAllMask,
  selectionForLayer,
  shapeMask,
  shrinkSelection,
} from "@/lib/shared/design/selection-state";

const placement = {
  x: 0,
  y: 0,
  width: 8,
  height: 8,
  rotation: 0,
  pixelWidth: 8,
  pixelHeight: 8,
};

const count = (data: Uint8Array) => data.reduce((sum, value) => sum + (value > 0 ? 1 : 0), 0);

describe("selection state", () => {
  it("maps modifier keys to combine modes", () => {
    expect(modeFromModifiers(false, false, SelectionCombine.Replace)).toBe(
      SelectionCombine.Replace,
    );
    expect(modeFromModifiers(true, false, SelectionCombine.Replace)).toBe(SelectionCombine.Add);
    expect(modeFromModifiers(false, true, SelectionCombine.Replace)).toBe(
      SelectionCombine.Subtract,
    );
    expect(modeFromModifiers(true, true, SelectionCombine.Replace)).toBe(
      SelectionCombine.Intersect,
    );
    expect(modeFromModifiers(false, false, SelectionCombine.Add)).toBe(SelectionCombine.Add);
  });

  it("builds square and centered marquee rectangles", () => {
    const square = marqueeRect({ x: 2, y: 2 }, { x: 6, y: 4 }, { square: true, center: false });
    expect(square).toEqual({ x: 2, y: 2, width: 4, height: 4 });
    const centered = marqueeRect({ x: 5, y: 5 }, { x: 8, y: 7 }, { square: false, center: true });
    expect(centered).toEqual({ x: 2, y: 3, width: 6, height: 4 });
    const backwards = marqueeRect({ x: 6, y: 6 }, { x: 2, y: 3 }, { square: false, center: false });
    expect(backwards).toEqual({ x: 2, y: 3, width: 4, height: 3 });
  });

  it("combines selections and drops empty results", () => {
    const left = rectMask(8, 8, { x: 0, y: 0, width: 4, height: 8 });
    const right = rectMask(8, 8, { x: 4, y: 0, width: 4, height: 8 });
    expect(applySelection(null, left, SelectionCombine.Subtract)).toBeNull();
    expect(applySelection(left, right, SelectionCombine.Intersect)).toBeNull();
    const both = applySelection(left, right, SelectionCombine.Add);
    expect(count(both?.data ?? new Uint8Array())).toBe(64);
    const rest = applySelection(both, left, SelectionCombine.Subtract);
    expect(count(rest?.data ?? new Uint8Array())).toBe(32);
  });

  it("inverts, grows and shrinks", () => {
    const mask = shapeMask(8, 8, {
      kind: MarqueeShape.Rect,
      rect: { x: 2, y: 2, width: 4, height: 4 },
    });
    expect(count(invertSelection(mask)?.data ?? new Uint8Array())).toBe(48);
    expect(count(growSelection(mask, 1)?.data ?? new Uint8Array())).toBe(36);
    expect(count(shrinkSelection(mask, 1)?.data ?? new Uint8Array())).toBe(4);
    expect(invertSelection(selectAllMask(8, 8))).toBeNull();
  });

  it("limits painting to the selected pixels", () => {
    const page = shapeMask(8, 8, {
      kind: MarqueeShape.Rect,
      rect: { x: 0, y: 0, width: 4, height: 8 },
    });
    const buffer = createPixelBuffer(8, 8);
    const stroke = beginStroke(buffer);
    const params = {
      size: 40,
      hardness: 1,
      opacity: 1,
      flow: 1,
      color: { r: 255, g: 0, b: 0 },
      erase: false,
      selection: selectionForLayer(page, placement),
    };
    paintStroke(stroke, [{ x: 4, y: 4 }], params, 25, undefined);
    finishStroke(stroke);
    const alphaAt = (x: number, y: number) => buffer.data[(y * 8 + x) * 4 + 3] ?? 0;
    expect(alphaAt(1, 4)).toBe(255);
    expect(alphaAt(6, 4)).toBe(0);
  });

  it("maps the page selection onto a scaled layer and back", () => {
    const page = shapeMask(8, 8, {
      kind: MarqueeShape.Rect,
      rect: { x: 0, y: 0, width: 4, height: 8 },
    });
    const half = { ...placement, pixelWidth: 4, pixelHeight: 4 };
    const layer = selectionForLayer(page, half);
    expect(layer.width).toBe(4);
    expect(count(layer.data)).toBe(8);
    const source = createPixelBuffer(4, 4, { r: 1, g: 2, b: 3, a: 255 });
    const expanded = layerToPageBuffer(source, half, 8, 8);
    expect(expanded.data[3]).toBe(255);
  });
});
