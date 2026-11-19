import { describe, expect, it } from "vitest";
import { createPath, defaultPathStroke } from "@/lib/shared/design/path";
import { rasterizedElement } from "@/lib/shared/design/rasterize";
import type { PathElement } from "@/lib/shared/design/schemas";
import {
  type GradientFactory,
  pathFillStyle,
  pathRasterFrame,
  pathStrokePadding,
} from "@/lib/shared/design/vector/path-paint";
import {
  DESIGN_LIMITS,
  DesignBlendMode,
  DesignElementKind,
  DesignPathCap,
  DesignPathJoin,
  DesignPathPaintKind,
} from "@/lib/shared/design/types";

const PAGE = { width: 1000, height: 1000 };

const base = (): PathElement => ({
  ...createPath(
    {
      id: "path-1",
      d: "M 0 0 L 100 0 L 100 50 Z",
      width: 100,
      height: 50,
    },
    PAGE,
  ),
  x: 40,
  y: 60,
});

const stroked = (patch: Partial<ReturnType<typeof defaultPathStroke>>): PathElement => ({
  ...base(),
  stroke: { ...defaultPathStroke("#112233"), ...patch },
});

describe("pathStrokePadding", () => {
  it("is zero without a stroke", () => {
    expect(pathStrokePadding(null)).toBe(0);
  });

  it("uses half the width for butt caps and bevel joins", () => {
    const stroke = { ...defaultPathStroke("#000000"), width: 10, join: DesignPathJoin.Bevel };
    expect(pathStrokePadding(stroke)).toBe(5);
  });

  it("uses the miter limit for miter joins", () => {
    const stroke = { ...defaultPathStroke("#000000"), width: 10, miterLimit: 4 };
    expect(pathStrokePadding(stroke)).toBe(20);
  });

  it("uses sqrt2 for square caps when it exceeds the join reach", () => {
    const stroke = {
      ...defaultPathStroke("#000000"),
      width: 10,
      cap: DesignPathCap.Square,
      join: DesignPathJoin.Round,
    };
    expect(pathStrokePadding(stroke)).toBeCloseTo(5 * Math.SQRT2);
  });
});

describe("pathRasterFrame", () => {
  it("keeps the frame without a stroke", () => {
    const element = base();
    expect(pathRasterFrame(element)).toEqual({ x: 40, y: 60, width: 100, height: 50 });
  });

  it("inflates symmetrically around the center", () => {
    const element = stroked({ width: 10, join: DesignPathJoin.Bevel });
    const frame = pathRasterFrame(element);
    expect(frame).toEqual({ x: 35, y: 55, width: 110, height: 60 });
    expect(frame.x + frame.width / 2).toBe(element.x + element.width / 2);
    expect(frame.y + frame.height / 2).toBe(element.y + element.height / 2);
  });

  it("never exceeds the maximum element size", () => {
    const element = { ...stroked({ width: 100, miterLimit: 20 }), width: DESIGN_LIMITS.maxSize };
    expect(pathRasterFrame(element).width).toBeLessThanOrEqual(DESIGN_LIMITS.maxSize);
  });
});

describe("rasterizedElement for a path", () => {
  it("uses the inflated frame and keeps rotation, name, opacity and blend", () => {
    const element: PathElement = {
      ...stroked({ width: 10, join: DesignPathJoin.Bevel }),
      rotation: 30,
      name: "Logo",
      opacity: 0.4,
      fillOpacity: 0.7,
      blendMode: DesignBlendMode.Multiply,
    };
    const layer = rasterizedElement(element, "raster-1", pathRasterFrame(element));
    expect(layer.kind).toBe(DesignElementKind.Raster);
    expect(layer).toMatchObject({
      id: "raster-1",
      x: 35,
      y: 55,
      width: 110,
      height: 60,
      rotation: 30,
      name: "Logo",
      opacity: 0.4,
      fillOpacity: 0.7,
      blendMode: DesignBlendMode.Multiply,
      pixelWidth: 110,
      pixelHeight: 60,
      pixelsVersionId: null,
    });
  });
});

type Call = [string, ...number[]];

const fakeContext = (calls: Call[]): GradientFactory => {
  const gradient = { addColorStop: (offset: number) => calls.push(["stop", offset]) };
  return {
    createLinearGradient: (...args: number[]) => {
      calls.push(["linear", ...args]);
      return gradient;
    },
    createRadialGradient: (...args: number[]) => {
      calls.push(["radial", ...args]);
      return gradient;
    },
  };
};

describe("pathFillStyle", () => {
  it("returns the color for a solid paint", () => {
    const calls: Call[] = [];
    const style = pathFillStyle(
      fakeContext(calls),
      { kind: DesignPathPaintKind.Solid, color: "#ff0000" },
      { width: 100, height: 50 },
    );
    expect(style).toBe("#ff0000");
    expect(calls).toEqual([]);
  });

  it("scales a linear gradient by fractions of the box and adds the stops in order", () => {
    const calls: Call[] = [];
    pathFillStyle(
      fakeContext(calls),
      {
        kind: DesignPathPaintKind.Linear,
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 0.5,
        stops: [
          { offset: 1, color: "#000000", alpha: 0.5 },
          { offset: 0, color: "#ffffff", alpha: 1 },
        ],
      },
      { width: 100, height: 50 },
    );
    expect(calls).toEqual([
      ["linear", 0, 0, 100, 25],
      ["stop", 0],
      ["stop", 1],
    ]);
  });

  it("uses a fraction of the smaller side as the radial radius", () => {
    const calls: Call[] = [];
    pathFillStyle(
      fakeContext(calls),
      {
        kind: DesignPathPaintKind.Radial,
        cx: 0.5,
        cy: 0.5,
        r: 0.5,
        stops: [
          { offset: 0, color: "#000000", alpha: 1 },
          { offset: 1, color: "#ffffff", alpha: 0 },
        ],
      },
      { width: 100, height: 50 },
    );
    expect(calls[0]).toEqual(["radial", 50, 25, 0, 50, 25, 25]);
  });
});
