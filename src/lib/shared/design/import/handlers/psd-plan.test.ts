import type { Layer, Psd } from "ag-psd";
import { describe, expect, it } from "vitest";
import { type PlanLimits, planPsd } from "@/lib/shared/design/import/handlers/psd-plan";
import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { DesignImportFailure } from "@/lib/shared/design/import/types";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const BUDGET = DESIGN_LIMITS.rasterBudgetBytes;

const limits = (extra: Partial<PlanLimits> = {}): PlanLimits => ({
  capacityElements: DESIGN_LIMITS.maxElements,
  remainingBytes: BUDGET,
  maxLayerSide: DESIGN_IMPORT_LIMITS.maxLayerSide,
  ...extra,
});

const raw = (colorMode = 3, bitsPerChannel = 8) => ({
  colorMode,
  bitsPerChannel,
  channels: [],
  large: false,
});

const pixelLayer = (left: number, top: number, width: number, height: number, extra: Layer = {}) =>
  ({
    left,
    top,
    right: left + width,
    bottom: top + height,
    rawData: raw(),
    ...extra,
  }) satisfies Layer;

const psdOf = (children: Layer[], size = 4096): Psd => ({
  width: size,
  height: size,
  children,
});

const failureOf = (result: ReturnType<typeof planPsd>) => (result.ok ? null : result.failure);

describe("planPsd layer count", () => {
  it("refuses 5000 leaf layers", () => {
    const layers = Array.from({ length: 5000 }, () => pixelLayer(0, 0, 8, 8));
    expect(failureOf(planPsd(psdOf(layers), limits()))).toBe(DesignImportFailure.TooManyLayers);
  });

  it("accepts exactly the capacity and refuses one more; groups do not count", () => {
    const leaves = (count: number) => Array.from({ length: count }, () => pixelLayer(0, 0, 8, 8));
    const group: Layer = { children: leaves(50) };
    expect(planPsd(psdOf([group]), limits({ capacityElements: 50 })).ok).toBe(true);
    expect(failureOf(planPsd(psdOf([group]), limits({ capacityElements: 49 })))).toBe(
      DesignImportFailure.TooManyLayers,
    );
    expect(planPsd(psdOf(leaves(200)), limits({ capacityElements: 200 })).ok).toBe(true);
    expect(failureOf(planPsd(psdOf(leaves(201)), limits({ capacityElements: 200 })))).toBe(
      DesignImportFailure.TooManyLayers,
    );
    expect(failureOf(planPsd(psdOf(leaves(51)), limits({ capacityElements: 50 })))).toBe(
      DesignImportFailure.TooManyLayers,
    );
  });
});

describe("planPsd byte budget", () => {
  it("compares one layer with the remaining budget exactly", () => {
    const side = 1024;
    const bytes = side * side * 4;
    const layer = [pixelLayer(0, 0, side, side)];
    expect(planPsd(psdOf(layer), limits({ remainingBytes: bytes * 2 })).ok).toBe(true);
    expect(failureOf(planPsd(psdOf(layer), limits({ remainingBytes: bytes * 2 - 4 })))).toBe(
      DesignImportFailure.Memory,
    );
  });

  it("compares exactly at the safe integer edge (layer plus crop = 8 bytes per pixel)", () => {
    const half = 2 ** 25;
    const wide = limits({
      maxLayerSide: Number.MAX_SAFE_INTEGER,
      remainingBytes: Number.MAX_SAFE_INTEGER,
    });
    const exactlyOver = psdOf([pixelLayer(0, 0, half, half)], half);
    expect(failureOf(planPsd(exactlyOver, wide))).toBe(DesignImportFailure.Memory);
    const justUnder = psdOf([pixelLayer(0, 0, half, half - 1)], half);
    expect(planPsd(justUnder, wide).ok).toBe(true);
  });

  it("refuses products far above the safe integer range without a pass-through", () => {
    const side = 94906267;
    expect(side * side * 4).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    const wide = limits({ maxLayerSide: Number.MAX_SAFE_INTEGER });
    const huge = psdOf([pixelLayer(0, 0, side, side)]);
    expect(failureOf(planPsd(huge, wide))).toBe(DesignImportFailure.Memory);
    const full = psdOf([pixelLayer(0, 0, 0xffffffff, 0xffffffff)]);
    expect(failureOf(planPsd(full, wide))).toBe(DesignImportFailure.Memory);
    expect(failureOf(planPsd(full, limits()))).toBe(DesignImportFailure.LayerTooLarge);
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a fractional value", 8.5],
    ["a value above the safe integer range", 2 ** 60],
  ])("refuses a layer whose right edge is %s as too large", (_name, right) => {
    const layer = pixelLayer(0, 0, 8, 8, { right });
    expect(failureOf(planPsd(psdOf([layer]), limits()))).toBe(DesignImportFailure.LayerTooLarge);
  });

  it("skips a layer whose right edge is left of its left edge", () => {
    const layer = pixelLayer(20, 0, 8, 8, { right: 10 });
    const result = planPsd(psdOf([layer]), limits());
    expect(result.ok && result.plan.decodeCount).toBe(0);
    expect(result.ok && result.plan.plannedBytes).toBe(0);
  });

  it("refuses layers by side at the exact boundary", () => {
    const max = DESIGN_IMPORT_LIMITS.maxLayerSide;
    expect(planPsd(psdOf([pixelLayer(0, 0, max, 1)]), limits()).ok).toBe(true);
    expect(failureOf(planPsd(psdOf([pixelLayer(0, 0, max + 1, 1)]), limits()))).toBe(
      DesignImportFailure.LayerTooLarge,
    );
    expect(failureOf(planPsd(psdOf([pixelLayer(0, 0, 300000, 300000)]), limits()))).toBe(
      DesignImportFailure.LayerTooLarge,
    );
  });

  it("counts only the part of a big layer that lands on the page", () => {
    const layer = pixelLayer(-9990, -9990, 10000, 10000);
    const result = planPsd(psdOf([layer], 64), limits());
    expect(result.ok && result.plan.plannedBytes).toBe(10 * 10 * 4);
    const outside = pixelLayer(1_000_000, -1_000_000, 100, 100);
    const skipped = planPsd(psdOf([outside], 64), limits());
    expect(skipped.ok && skipped.plan.plannedBytes).toBe(0);
    expect(skipped.ok && skipped.plan.decodeCount).toBe(0);
  });

  it("refuses when the sum of layers plus the store usage passes the raster budget", () => {
    const layers = Array.from({ length: 10 }, () => pixelLayer(0, 0, 4096, 4096));
    expect(failureOf(planPsd(psdOf(layers), limits()))).toBe(DesignImportFailure.Memory);
    const one = [pixelLayer(0, 0, 2048, 2048)];
    const used = BUDGET - 2048 * 2048 * 4 * 2;
    expect(planPsd(psdOf(one), limits({ remainingBytes: BUDGET - used })).ok).toBe(true);
    expect(failureOf(planPsd(psdOf(one), limits({ remainingBytes: BUDGET - used - 4 })))).toBe(
      DesignImportFailure.Memory,
    );
  });

  it.each([
    ["RGB 8-bit", 3, 8, 8],
    ["RGB 16-bit", 3, 16, 12],
    ["RGB 32-bit", 3, 32, 20],
    ["CMYK 8-bit", 4, 8, 13],
    ["CMYK 16-bit", 4, 16, 22],
  ])("charges %s exactly (%i bytes per pixel in the plan)", (_name, mode, bits, perPixel) => {
    const side = 1024;
    const layer: Layer = { ...pixelLayer(0, 0, side, side), rawData: raw(mode, bits) };
    const need = side * side * perPixel;
    expect(planPsd(psdOf([layer]), limits({ remainingBytes: need })).ok).toBe(true);
    expect(failureOf(planPsd(psdOf([layer]), limits({ remainingBytes: need - 1 })))).toBe(
      DesignImportFailure.Memory,
    );
  });

  it("checks layer pixels, crop and mask together against the remaining budget", () => {
    const side = 512;
    const rgb = side * side * 4;
    const mask = { left: 0, top: 0, right: side, bottom: side };
    const layer = pixelLayer(0, 0, side, side, { mask });
    expect(planPsd(psdOf([layer]), limits({ remainingBytes: rgb * 3 })).ok).toBe(true);
    expect(failureOf(planPsd(psdOf([layer]), limits({ remainingBytes: rgb * 3 - 4 })))).toBe(
      DesignImportFailure.Memory,
    );
  });

  it("charges mask rectangles and refuses a mask that is too large", () => {
    const mask = { left: 0, top: 0, right: 20000, bottom: 4 };
    const layer = pixelLayer(0, 0, 8, 8, { mask });
    expect(failureOf(planPsd(psdOf([layer]), limits()))).toBe(DesignImportFailure.LayerTooLarge);
  });
});

describe("planPsd walk", () => {
  it("walks a 5000-level tree without recursion", () => {
    let layer: Layer = pixelLayer(0, 0, 8, 8);
    for (let depth = 0; depth < 5000; depth += 1) layer = { children: [layer] };
    const result = planPsd(psdOf([layer]), limits());
    expect(result.ok && result.plan.nodes).toHaveLength(5001);
    expect(result.ok && result.plan.nodes.at(-1)?.depth).toBe(5000);
  });

  it("plans the composite image of a flat file", () => {
    const flat: Psd = { width: 64, height: 64, rawCompositeData: new Uint8Array(4) };
    const result = planPsd(flat, limits());
    expect(result.ok && result.plan.nodes[0]?.composite).toBe(true);
    expect(planPsd(flat, limits({ remainingBytes: 64 * 64 * 4 * 2 })).ok).toBe(true);
    expect(failureOf(planPsd(flat, limits({ remainingBytes: 64 * 64 * 4 * 2 - 1 })))).toBe(
      DesignImportFailure.Memory,
    );
  });
});
