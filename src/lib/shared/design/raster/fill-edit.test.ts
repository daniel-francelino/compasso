import { describe, expect, it } from "vitest";
import { bucketPatch, gradientPatch } from "@/lib/shared/design/raster/fill-edit";
import { applyPatch, revertPatch } from "@/lib/shared/design/raster/pixel-history";
import { createPixelBuffer, getPixel, setPixel } from "@/lib/shared/design/raster/pixel-buffer";
import { rectMask } from "@/lib/shared/design/raster/selection";
import { DesignBlendMode } from "@/lib/shared/design/types";
import { FILL_LIMITS, clampPercent, clampTolerance } from "@/lib/shared/design/fill-tools";

const red = { r: 255, g: 0, b: 0, a: 255 };
const blue = { r: 0, g: 0, b: 255, a: 255 };
const normal = { opacity: 1, blendMode: DesignBlendMode.Normal };

describe("bucketPatch", () => {
  it("fills the contiguous region and reverts through the patch", () => {
    const buffer = createPixelBuffer(4, 1);
    setPixel(buffer, 2, 0, blue);
    const patch = bucketPatch(buffer, 0, 0, red, { tolerance: 0, contiguous: true, ...normal });
    expect(getPixel(buffer, 1, 0)).toEqual(red);
    expect(getPixel(buffer, 2, 0)).toEqual(blue);
    expect(getPixel(buffer, 3, 0).a).toBe(0);
    if (patch === null) throw new Error("patch");
    revertPatch(buffer, patch);
    expect(getPixel(buffer, 0, 0).a).toBe(0);
    applyPatch(buffer, patch);
    expect(getPixel(buffer, 0, 0)).toEqual(red);
  });

  it("fills non-contiguous matches and respects the selection", () => {
    const buffer = createPixelBuffer(4, 1);
    setPixel(buffer, 2, 0, blue);
    const selection = rectMask(4, 1, { x: 0, y: 0, width: 4, height: 1 });
    bucketPatch(buffer, 0, 0, red, {
      tolerance: 0,
      contiguous: false,
      selection: rectMask(4, 1, { x: 0, y: 0, width: 2, height: 1 }),
      ...normal,
    });
    expect(selection.data[0]).toBe(255);
    expect(getPixel(buffer, 1, 0)).toEqual(red);
    expect(getPixel(buffer, 3, 0).a).toBe(0);
  });

  it("scales by opacity and returns null when nothing changes", () => {
    const buffer = createPixelBuffer(2, 1);
    bucketPatch(buffer, 0, 0, red, {
      tolerance: 0,
      contiguous: true,
      opacity: 0.5,
      blendMode: DesignBlendMode.Normal,
    });
    expect(getPixel(buffer, 0, 0).a).toBe(128);
    const solid = createPixelBuffer(2, 1, red);
    expect(bucketPatch(solid, 0, 0, red, { tolerance: 0, contiguous: true, ...normal })).toBeNull();
  });

  it("applies a blend mode", () => {
    const buffer = createPixelBuffer(1, 1, { r: 100, g: 100, b: 100, a: 255 });
    bucketPatch(
      buffer,
      0,
      0,
      { r: 255, g: 255, b: 255, a: 255 },
      {
        tolerance: 0,
        contiguous: true,
        opacity: 1,
        blendMode: DesignBlendMode.Multiply,
      },
    );
    expect(getPixel(buffer, 0, 0)).toMatchObject({ r: 100, g: 100, b: 100 });
  });
});

describe("gradientPatch", () => {
  it("paints a linear gradient and stays inside the selection", () => {
    const buffer = createPixelBuffer(4, 1);
    const patch = gradientPatch(
      buffer,
      { kind: "linear", from: { x: 0, y: 0 }, to: { x: 4, y: 0 } },
      red,
      blue,
      normal,
      rectMask(4, 1, { x: 0, y: 0, width: 2, height: 1 }),
    );
    expect(patch).not.toBeNull();
    expect(getPixel(buffer, 0, 0).r).toBeGreaterThan(getPixel(buffer, 1, 0).r);
    expect(getPixel(buffer, 3, 0).a).toBe(0);
  });

  it("supports radial shape, blend and an empty selection", () => {
    const buffer = createPixelBuffer(3, 3, { r: 10, g: 10, b: 10, a: 255 });
    const patch = gradientPatch(
      buffer,
      { kind: "radial", center: { x: 1.5, y: 1.5 }, radius: 2 },
      red,
      blue,
      { opacity: 1, blendMode: DesignBlendMode.Screen },
    );
    expect(patch).not.toBeNull();
    expect(getPixel(buffer, 1, 1).r).toBeGreaterThan(10);
    const empty = rectMask(3, 3, { x: 0, y: 0, width: 0, height: 0 });
    expect(
      gradientPatch(
        buffer,
        { kind: "radial", center: { x: 0, y: 0 }, radius: 1 },
        red,
        blue,
        normal,
        empty,
      ),
    ).toBeNull();
  });
});

describe("fill option clamps", () => {
  it("clamps percent and tolerance", () => {
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampTolerance(-5)).toBe(FILL_LIMITS.minTolerance);
    expect(clampTolerance(999)).toBe(FILL_LIMITS.maxTolerance);
  });
});
