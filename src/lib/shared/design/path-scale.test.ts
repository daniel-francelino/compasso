import { describe, expect, it } from "vitest";
import { createPath, defaultPathStroke } from "@/lib/shared/design/path";
import { scalePathStroke } from "@/lib/shared/design/path-scale";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const withWidth = (width: number) =>
  createPath(
    {
      id: "p",
      d: "M0 0L10 10",
      width: 10,
      height: 10,
      stroke: { ...defaultPathStroke("#112233"), width },
    },
    { width: 100, height: 100 },
  );

describe("scalePathStroke", () => {
  it("scales the stroke width with the page", () => {
    expect(scalePathStroke(withWidth(4), 0.5).stroke?.width).toBe(2);
  });

  it("keeps a thin stroke above zero", () => {
    const width = scalePathStroke(withWidth(0.2), 0.01).stroke?.width ?? 0;
    expect(width).toBe(DESIGN_LIMITS.minPathStrokeWidth);
  });

  it("never rounds a small scaled width to zero", () => {
    const width = scalePathStroke(withWidth(0.3), 0.001).stroke?.width ?? 0;
    expect(width).toBeGreaterThan(0);
  });

  it("clamps to the maximum", () => {
    expect(scalePathStroke(withWidth(80), 10).stroke?.width).toBe(DESIGN_LIMITS.maxPathStrokeWidth);
  });

  it("leaves a path without stroke and a bad scale untouched", () => {
    const none = { ...withWidth(2), stroke: null };
    expect(scalePathStroke(none, 2)).toBe(none);
    const same = withWidth(2);
    expect(scalePathStroke(same, Number.NaN)).toBe(same);
  });
});
