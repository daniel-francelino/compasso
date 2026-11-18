import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRUSH_OPTIONS,
  adjustBrushByKey,
  cursorDiameterPx,
  docToLayerPoint,
  hexToRgb,
  withBrushOption,
} from "@/lib/shared/design/paint";

const placement = {
  x: 100,
  y: 50,
  width: 200,
  height: 100,
  rotation: 0,
  pixelWidth: 400,
  pixelHeight: 200,
};

describe("brush keys", () => {
  it("steps the size, the hardness and the opacity", () => {
    const base = { ...DEFAULT_BRUSH_OPTIONS, size: 100 };
    expect(adjustBrushByKey(base, "]", false)?.size).toBe(110);
    expect(adjustBrushByKey(base, "[", false)?.size).toBe(90);
    expect(adjustBrushByKey(base, "}", false)?.hardness).toBe(90);
    expect(adjustBrushByKey(base, "[", true)?.hardness).toBe(70);
    expect(adjustBrushByKey(base, "5", false)?.opacity).toBe(50);
    expect(adjustBrushByKey(base, "0", false)?.opacity).toBe(100);
    expect(adjustBrushByKey(base, "q", false)).toBeNull();
    expect(adjustBrushByKey(base, ".", false)?.size).toBe(110);
    expect(adjustBrushByKey(base, ",", false)?.size).toBe(90);
    expect(adjustBrushByKey(base, "Dead", false, "BracketRight")?.size).toBe(110);
    expect(adjustBrushByKey(base, "Dead", true, "BracketLeft")?.hardness).toBe(70);
  });

  it("clamps every option", () => {
    expect(withBrushOption(DEFAULT_BRUSH_OPTIONS, "size", 5000).size).toBe(1000);
    expect(withBrushOption(DEFAULT_BRUSH_OPTIONS, "size", 0).size).toBe(1);
    expect(withBrushOption(DEFAULT_BRUSH_OPTIONS, "flow", -4).flow).toBe(0);
    expect(withBrushOption(DEFAULT_BRUSH_OPTIONS, "flow", Number.NaN).flow).toBe(0);
  });

  it("keeps a two pixel dot at low zoom", () => {
    expect(cursorDiameterPx({ ...DEFAULT_BRUSH_OPTIONS, size: 3 }, 0.1)).toBe(2);
  });
});

describe("docToLayerPoint", () => {
  it("maps translate and scale", () => {
    expect(docToLayerPoint(placement, { x: 100, y: 50 })).toEqual({ x: 0, y: 0 });
    expect(docToLayerPoint(placement, { x: 300, y: 150 })).toEqual({ x: 400, y: 200 });
  });

  it("maps through a rotation around the center", () => {
    const rotated = { ...placement, rotation: 90 };
    const point = docToLayerPoint(rotated, { x: 200, y: 150 });
    expect(point.x).toBeCloseTo(300, 5);
    expect(point.y).toBeCloseTo(100, 5);
  });
});

describe("hexToRgb", () => {
  it("parses a hex color", () => {
    expect(hexToRgb("#102030")).toEqual({ r: 16, g: 32, b: 48 });
    expect(hexToRgb("red")).toBeNull();
  });
});
