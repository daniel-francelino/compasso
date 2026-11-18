import { describe, expect, it } from "vitest";
import {
  FILTER_TILE,
  blendFiltered,
  cropBuffer,
  executeFilter,
  planFilter,
  restoreRegion,
} from "@/lib/shared/design/raster/filter-run";
import {
  DesignFilter,
  defaultFilterParams,
  filterHalo,
  normalizeFilterParams,
} from "@/lib/shared/design/raster/filter-types";
import { gaussianBlur, pixelate } from "@/lib/shared/design/raster/filters";
import { createSeededRandom } from "@/lib/shared/design/raster/numeric";
import { createPixelBuffer, getPixel } from "@/lib/shared/design/raster/pixel-buffer";
import { createMask, rectMask } from "@/lib/shared/design/raster/selection";

const noisy = (width: number, height: number) => {
  const buffer = createPixelBuffer(width, height);
  const random = createSeededRandom(7);
  for (let i = 0; i < buffer.data.length; i += 4) {
    buffer.data[i] = random() * 255;
    buffer.data[i + 1] = random() * 255;
    buffer.data[i + 2] = random() * 255;
    buffer.data[i + 3] = 255;
  }
  return buffer;
};

describe("filter parameters", () => {
  it("clamps and rounds values", () => {
    const blur = normalizeFilterParams({ filter: DesignFilter.GaussianBlur, radius: 999.4 });
    expect(blur).toEqual({ filter: DesignFilter.GaussianBlur, radius: 100 });
    const cell = normalizeFilterParams({ filter: DesignFilter.Pixelate, cell: Number.NaN });
    expect(cell).toEqual({ filter: DesignFilter.Pixelate, cell: 2 });
  });

  it("needs a halo only for kernels", () => {
    expect(filterHalo({ filter: DesignFilter.GaussianBlur, radius: 4 })).toBe(12);
    expect(filterHalo(defaultFilterParams(DesignFilter.Noise))).toBe(0);
    expect(filterHalo(defaultFilterParams(DesignFilter.Pixelate))).toBe(0);
  });
});

describe("planFilter", () => {
  it("grows the crop by the halo and clips it to the layer", () => {
    const plan = planFilter(
      100,
      100,
      { x: 10, y: 0, width: 20, height: 20 },
      {
        filter: DesignFilter.GaussianBlur,
        radius: 2,
      },
    );
    expect(plan?.crop).toEqual({ x: 4, y: 0, width: 32, height: 26 });
    expect(plan?.inner).toEqual({ x: 6, y: 0, width: 20, height: 20 });
  });

  it("returns null for a region outside the layer", () => {
    const params = defaultFilterParams(DesignFilter.Pixelate);
    expect(planFilter(10, 10, { x: 20, y: 20, width: 5, height: 5 }, params)).toBeNull();
  });
});

describe("executeFilter", () => {
  it("tiled blur equals the whole-buffer blur", () => {
    const size = FILTER_TILE + 70;
    const source = noisy(size, 40);
    const params = { filter: DesignFilter.GaussianBlur, radius: 3 } as const;
    const whole = gaussianBlur(source, 3);
    const tiled = executeFilter(source, { x: 0, y: 0, width: size, height: 40 }, params);
    for (const x of [0, 1, FILTER_TILE - 1, FILTER_TILE, FILTER_TILE + 5, size - 1]) {
      expect(getPixel(tiled, x, 20)).toEqual(getPixel(whole, x, 20));
    }
  });

  it("filters only the inner region using the halo", () => {
    const source = noisy(64, 64);
    const region = { x: 20, y: 20, width: 16, height: 16 };
    const params = { filter: DesignFilter.GaussianBlur, radius: 2 } as const;
    const plan = planFilter(64, 64, region, params);
    if (plan === null) throw new Error("plan");
    const result = executeFilter(cropBuffer(source, plan.crop), plan.inner, params);
    const whole = gaussianBlur(source, 2);
    expect(result.width).toBe(16);
    expect(getPixel(result, 0, 0)).toEqual(getPixel(whole, 20, 20));
    expect(getPixel(result, 15, 15)).toEqual(getPixel(whole, 35, 35));
  });

  it("is deterministic for noise and matches pixelate", () => {
    const source = noisy(24, 24);
    const area = { x: 0, y: 0, width: 24, height: 24 };
    const noise = { filter: DesignFilter.Noise, amount: 30, monochrome: false, seed: 5 } as const;
    expect(executeFilter(source, area, noise).data).toEqual(
      executeFilter(source, area, noise).data,
    );
    const cells = executeFilter(source, area, { filter: DesignFilter.Pixelate, cell: 6 });
    expect(cells.data).toEqual(pixelate(source, 6).data);
  });
});

describe("blendFiltered", () => {
  it("applies the result only where the selection allows", () => {
    const original = createPixelBuffer(4, 1, { r: 0, g: 0, b: 0, a: 255 });
    const filtered = createPixelBuffer(4, 1, { r: 200, g: 200, b: 200, a: 255 });
    const target = createPixelBuffer(4, 1, { r: 9, g: 9, b: 9, a: 255 });
    const mask = rectMask(4, 1, { x: 0, y: 0, width: 2, height: 1 });
    mask.data[1] = 128;
    blendFiltered(target, original, filtered, { x: 0, y: 0, width: 4, height: 1 }, mask);
    expect(getPixel(target, 0, 0).r).toBe(200);
    expect(getPixel(target, 1, 0).r).toBe(100);
    expect(getPixel(target, 2, 0).r).toBe(0);
  });

  it("restores the original in a region", () => {
    const original = createPixelBuffer(4, 4, { r: 1, g: 2, b: 3, a: 255 });
    const target = createPixelBuffer(4, 4, { r: 9, g: 9, b: 9, a: 255 });
    restoreRegion(target, original, { x: 1, y: 1, width: 2, height: 2 });
    expect(getPixel(target, 1, 1).r).toBe(1);
    expect(getPixel(target, 0, 0).r).toBe(9);
    expect(createMask(1, 1).data.length).toBe(1);
  });
});
