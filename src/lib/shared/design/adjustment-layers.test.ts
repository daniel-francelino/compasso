import { describe, expect, it } from "vitest";
import {
  addCurvePoint,
  removeCurvePoint,
  setCurvePoint,
  canClipToBelow,
  createAdjustmentLayer,
  insertAdjustment,
  insertIndexFor,
  patchAdjustment,
  toggleClipToBelow,
} from "@/lib/shared/design/adjustment-layers";
import { createRasterLayer, createText, emptyPage, addElement } from "@/lib/shared/design/document";
import { AdjustmentType } from "@/lib/shared/design/raster/adjustment-types";
import { defaultAdjustment } from "@/lib/shared/design/raster/adjustments";
import { DesignElementKind, DesignPreset } from "@/lib/shared/design/types";

const SIZE = { width: 100, height: 100 };
const PALETTE = { ink: "#111111", surface: "#eeeeee", accent: "#ff0000" };

const build = () => {
  let page = emptyPage("p");
  page = addElement(page, createRasterLayer("r1", page, SIZE));
  page = addElement(page, createText("t1", DesignPreset.FeedSquare, PALETTE));
  return page;
};

describe("adjustment layers", () => {
  it("creates a named layer with default parameters", () => {
    const layer = createAdjustmentLayer("a", AdjustmentType.Curves, SIZE);
    expect(layer.name).toBe("Curvas");
    expect(layer.adjustment).toEqual(defaultAdjustment(AdjustmentType.Curves));
  });

  it("inserts above the selected pixel layer, else above the top pixel layer", () => {
    const page = build();
    const layer = createAdjustmentLayer("a", AdjustmentType.Invert, SIZE);
    expect(insertAdjustment(page, layer, "r1").elements.map((e) => e.id)).toEqual([
      "r1",
      "a",
      "t1",
    ]);
    expect(insertAdjustment(page, layer, "t1").elements.map((e) => e.id)).toEqual([
      "r1",
      "a",
      "t1",
    ]);
    expect(insertIndexFor(emptyPage("x"), null)).toBe(0);
  });

  it("patches only valid parameters and clamps values", () => {
    const base = insertAdjustment(
      build(),
      createAdjustmentLayer("a", AdjustmentType.Threshold, SIZE),
      "r1",
    );
    const next = patchAdjustment(base, "a", { type: AdjustmentType.Threshold, level: 999 });
    const found = next.elements.find((e) => e.id === "a");
    expect(found?.kind === DesignElementKind.Adjustment && found.adjustment).toEqual({
      type: AdjustmentType.Threshold,
      level: 255,
    });
    const bad = patchAdjustment(base, "a", {
      type: AdjustmentType.Curves,
      channels: { rgb: [], red: [], green: [], blue: [] },
    });
    expect(bad).toBe(base);
  });

  it("clips only above another pixel layer and can always release", () => {
    let page = build();
    page = insertAdjustment(page, createAdjustmentLayer("a", AdjustmentType.Invert, SIZE), "r1");
    expect(canClipToBelow(page, "r1")).toBe(false);
    expect(canClipToBelow(page, "t1")).toBe(false);
    expect(canClipToBelow(page, "a")).toBe(true);
    const clipped = toggleClipToBelow(page, "a");
    expect(clipped.elements.find((e) => e.id === "a")?.clipToBelow).toBe(true);
    expect(toggleClipToBelow(clipped, "a").elements.find((e) => e.id === "a")?.clipToBelow).toBe(
      false,
    );
    expect(toggleClipToBelow(page, "r1")).toBe(page);
  });
});

describe("curve points", () => {
  const line = [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ];

  it("adds a midpoint, edits within neighbours and keeps at least two points", () => {
    const three = addCurvePoint(line);
    expect(three).toEqual([line[0], { x: 128, y: 128 }, line[1]]);
    expect(setCurvePoint(three, 1, "x", 999)[1]?.x).toBe(254);
    expect(setCurvePoint(three, 1, "y", -4)[1]?.y).toBe(0);
    expect(removeCurvePoint(three, 1)).toEqual(line);
    expect(removeCurvePoint(line, 0)).toEqual(line);
  });

  it("stops adding at the point limit", () => {
    let points = line;
    for (let i = 0; i < 30; i += 1) points = addCurvePoint(points);
    expect(points).toHaveLength(16);
  });
});
