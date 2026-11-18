import { describe, expect, it } from "vitest";
import { createImage } from "@/lib/shared/design/document";
import {
  adjustBrightnessContrast,
  rasterizedElement,
  rasterizedPixelSize,
  replaceElement,
} from "@/lib/shared/design/rasterize";
import { DESIGN_LIMITS, DesignElementKind, DesignPreset } from "@/lib/shared/design/types";

const IMAGE_ID = "33333333-3333-4333-8333-333333333333";

describe("rasterizedPixelSize", () => {
  it("keeps the frame size when it fits", () => {
    expect(rasterizedPixelSize(300, 200)).toEqual({ pixelWidth: 300, pixelHeight: 200 });
  });

  it("scales down to the raster side limit keeping the ratio", () => {
    const size = rasterizedPixelSize(DESIGN_LIMITS.maxRasterSide * 2, DESIGN_LIMITS.maxRasterSide);
    expect(size).toEqual({
      pixelWidth: DESIGN_LIMITS.maxRasterSide,
      pixelHeight: DESIGN_LIMITS.maxRasterSide / 2,
    });
  });
});

describe("rasterizedElement", () => {
  const page = { id: "p1", background: null, elements: [] };
  const source = {
    ...createImage("img", DesignPreset.FeedSquare, IMAGE_ID, null),
    name: "Foto",
    opacity: 0.5,
    blendMode: "multiply" as const,
    x: 10,
    y: 20,
  };

  it("keeps frame, name, blend and opacity under a new id", () => {
    const layer = rasterizedElement(source, "new-id");
    expect(layer.kind).toBe(DesignElementKind.Raster);
    expect(layer).toMatchObject({
      id: "new-id",
      name: "Foto",
      opacity: 0.5,
      blendMode: "multiply",
      x: 10,
      y: 20,
      width: source.width,
      height: source.height,
      pixelsVersionId: null,
    });
  });

  it("replaces the element in the same stack position", () => {
    const layer = rasterizedElement(source, "new-id");
    const stacked = { ...page, elements: [source, { ...source, id: "top" }] };
    const next = replaceElement(stacked, source.id, layer);
    expect(next.elements.map((item) => item.id)).toEqual(["new-id", "top"]);
  });
});

describe("adjustBrightnessContrast", () => {
  it("leaves pixels untouched with zero values and never alters alpha", () => {
    const data = new Uint8ClampedArray([10, 100, 200, 77]);
    adjustBrightnessContrast(data, 0, 0);
    expect([...data]).toEqual([10, 100, 200, 77]);
  });

  it("brightens and clamps", () => {
    const data = new Uint8ClampedArray([100, 250, 0, 255]);
    adjustBrightnessContrast(data, 0.5, 0);
    expect(data[0]).toBeGreaterThanOrEqual(227);
    expect(data[0]).toBeLessThanOrEqual(228);
    expect([data[1], data[3]]).toEqual([255, 255]);
  });
});
