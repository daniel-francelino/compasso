import { describe, expect, it } from "vitest";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import {
  boxFromPoints,
  fitViewport,
  panViewport,
  rulerTicks,
  snapAngle,
  stepZoom,
  toDocument,
  zoomAt,
} from "@/lib/shared/design/viewport";

const page = { width: 1080, height: 1350 };

describe("design viewport", () => {
  it("fits the whole page inside the area with padding and centers it", () => {
    const view = fitViewport(page, { width: 1000, height: 800 }, 50);
    expect(view.zoom).toBeCloseTo(700 / 1350, 5);
    expect(view.x + (page.width * view.zoom) / 2).toBeCloseTo(500, 0);
    expect(view.y).toBe(50);
  });

  it("keeps the document point under the cursor fixed when zooming", () => {
    const view = { zoom: 0.5, x: 100, y: 40 };
    const cursor = { x: 400, y: 300 };
    const before = toDocument(view, cursor);
    const after = toDocument(zoomAt(view, 2, cursor), cursor);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("clamps the zoom to its limits", () => {
    expect(zoomAt({ zoom: 1, x: 0, y: 0 }, 100, { x: 0, y: 0 }).zoom).toBe(
      DESIGN_LIMITS.maxViewZoom,
    );
    expect(zoomAt({ zoom: 1, x: 0, y: 0 }, 0, { x: 0, y: 0 }).zoom).toBe(DESIGN_LIMITS.minViewZoom);
  });

  it("steps through the zoom presets", () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1, -1)).toBe(0.67);
    expect(stepZoom(0.52, 1)).toBe(0.67);
    expect(stepZoom(DESIGN_LIMITS.maxViewZoom, 1)).toBe(DESIGN_LIMITS.maxViewZoom);
  });

  it("pans by screen pixels", () => {
    expect(panViewport({ zoom: 2, x: 10, y: 10 }, -5, 15)).toEqual({ zoom: 2, x: 5, y: 25 });
  });
});

describe("design ruler and drawing", () => {
  it("places ticks at a readable step from the page origin", () => {
    const ticks = rulerTicks(100, 0.5, 800);
    expect(ticks[0]).toEqual({ value: -200, at: 0 });
    expect(ticks[1]).toEqual({ value: 0, at: 100 });
    expect(
      ticks.every((tick, index) => index === 0 || tick.at - (ticks[index - 1]?.at ?? 0) >= 60),
    ).toBe(true);
  });

  it("builds a box from two points in any direction and squares it with Shift", () => {
    expect(boxFromPoints({ x: 100, y: 100 }, { x: 40, y: 10 }, false)).toEqual({
      x: 40,
      y: 10,
      width: 60,
      height: 90,
    });
    expect(boxFromPoints({ x: 0, y: 0 }, { x: 30, y: -80 }, true)).toEqual({
      x: 0,
      y: -80,
      width: 80,
      height: 80,
    });
  });

  it("snaps a line to steps of 45 degrees", () => {
    const end = snapAngle({ x: 0, y: 0 }, { x: 100, y: 8 });
    expect(end.x).toBeCloseTo(Math.hypot(100, 8), 5);
    expect(end.y).toBeCloseTo(0, 5);
  });
});
