import { describe, expect, it } from "vitest";
import { AdjustmentType } from "@/lib/shared/design/raster/adjustment-types";
import { defaultAdjustment } from "@/lib/shared/design/raster/adjustments";
import {
  createPixelBuffer,
  getPixel,
  setPixel,
  type PixelBuffer,
} from "@/lib/shared/design/raster/pixel-buffer";
import {
  PipelineLayerKind,
  evaluateLayerStack,
  type PipelineAdjustmentLayer,
  type PipelineRasterLayer,
} from "@/lib/shared/design/raster/pipeline";
import { DesignBlendMode } from "@/lib/shared/design/types";

const raster = (id: string, overrides: Partial<PipelineRasterLayer> = {}): PipelineRasterLayer => ({
  kind: PipelineLayerKind.Raster,
  id,
  sourceId: id,
  hidden: false,
  opacity: 1,
  fillOpacity: 1,
  blendMode: DesignBlendMode.Normal,
  clipToBelow: false,
  mask: null,
  x: 0,
  y: 0,
  ...overrides,
});

const invertLayer = (
  overrides: Partial<PipelineAdjustmentLayer> = {},
): PipelineAdjustmentLayer => ({
  kind: PipelineLayerKind.Adjustment,
  id: "adj",
  hidden: false,
  opacity: 1,
  fillOpacity: 1,
  blendMode: DesignBlendMode.Normal,
  clipToBelow: false,
  mask: null,
  adjustment: defaultAdjustment(AdjustmentType.Invert),
  ...overrides,
});

const solid = (r: number, g: number, b: number, a = 255, w = 2): PixelBuffer =>
  createPixelBuffer(w, 1, { r, g, b, a });

const options = { width: 2, height: 1 };

describe("evaluateLayerStack", () => {
  it("returns the background or transparency for an empty stack", () => {
    expect(getPixel(evaluateLayerStack([], new Map(), options), 0, 0).a).toBe(0);
    const white = evaluateLayerStack([], new Map(), {
      ...options,
      background: { r: 255, g: 255, b: 255, a: 255 },
    });
    expect(getPixel(white, 1, 0)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });

  it("applies opacity and fill opacity then blends", () => {
    const sources = new Map([["a", solid(255, 255, 255)]]);
    const out = evaluateLayerStack([raster("a", { opacity: 0.5, fillOpacity: 0.5 })], sources, {
      ...options,
      background: { r: 0, g: 0, b: 0, a: 255 },
    });
    expect(getPixel(out, 0, 0).r).toBe(64);
  });

  it("skips hidden layers and layers without a source", () => {
    const sources = new Map([["a", solid(255, 0, 0)]]);
    const out = evaluateLayerStack(
      [raster("a", { hidden: true }), raster("missing")],
      sources,
      options,
    );
    expect(getPixel(out, 0, 0).a).toBe(0);
  });

  it("uses the blend mode and the layer order", () => {
    const sources = new Map([
      ["a", solid(255, 128, 0)],
      ["b", solid(128, 128, 128)],
    ]);
    const out = evaluateLayerStack(
      [raster("a"), raster("b", { blendMode: DesignBlendMode.Multiply })],
      sources,
      options,
    );
    expect(getPixel(out, 0, 0)).toEqual({ r: 128, g: 64, b: 0, a: 255 });
  });

  it("applies the layer mask", () => {
    const sources = new Map([["a", solid(255, 0, 0)]]);
    const mask = { width: 2, height: 1, data: Uint8Array.of(255, 0) };
    const out = evaluateLayerStack([raster("a", { mask })], sources, options);
    expect(getPixel(out, 0, 0).a).toBe(255);
    expect(getPixel(out, 1, 0).a).toBe(0);
  });

  it("places a layer at an offset", () => {
    const sources = new Map([["a", solid(9, 9, 9, 255, 1)]]);
    const out = evaluateLayerStack([raster("a", { x: 1 })], sources, options);
    expect(getPixel(out, 0, 0).a).toBe(0);
    expect(getPixel(out, 1, 0).r).toBe(9);
  });
});

describe("adjustment layers", () => {
  const sources = () =>
    new Map([
      ["red", solid(255, 0, 0)],
      ["top", solid(0, 0, 255)],
    ]);

  it("affect everything below and nothing above", () => {
    const out = evaluateLayerStack(
      [raster("red"), invertLayer(), raster("top", { x: 1, sourceId: "top" })],
      new Map([
        ["red", solid(255, 0, 0)],
        ["top", solid(0, 0, 255, 255, 1)],
      ]),
      options,
    );
    expect(getPixel(out, 0, 0)).toEqual({ r: 0, g: 255, b: 255, a: 255 });
    expect(getPixel(out, 1, 0)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
  });

  it("mix with the opacity and keep transparent pixels transparent", () => {
    const out = evaluateLayerStack(
      [raster("red"), invertLayer({ opacity: 0.5 })],
      new Map([["red", solid(255, 0, 0, 255, 1)]]),
      options,
    );
    expect(getPixel(out, 0, 0).r).toBe(128);
    expect(getPixel(out, 1, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("with clipToBelow only change where the layer below has pixels", () => {
    const gray = solid(100, 100, 100);
    const patch = createPixelBuffer(2, 1);
    setPixel(patch, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
    const out = evaluateLayerStack(
      [raster("gray"), raster("patch"), invertLayer({ clipToBelow: true })],
      new Map([
        ["gray", gray],
        ["patch", patch],
      ]),
      options,
    );
    expect(getPixel(out, 0, 0)).toEqual({ r: 0, g: 255, b: 255, a: 255 });
    expect(getPixel(out, 1, 0)).toEqual({ r: 100, g: 100, b: 100, a: 255 });
  });

  it("do nothing when hidden", () => {
    const out = evaluateLayerStack(
      [raster("red"), invertLayer({ hidden: true })],
      sources(),
      options,
    );
    expect(getPixel(out, 0, 0).r).toBe(255);
  });
});

describe("clipping", () => {
  const base = () => {
    const patch = createPixelBuffer(2, 1);
    setPixel(patch, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
    return patch;
  };

  it("clips a raster layer to the alpha of the layer below", () => {
    const out = evaluateLayerStack(
      [raster("base"), raster("top", { clipToBelow: true })],
      new Map([
        ["base", base()],
        ["top", solid(255, 255, 255)],
      ]),
      options,
    );
    expect(getPixel(out, 0, 0).r).toBe(255);
    expect(getPixel(out, 0, 0).g).toBe(255);
    expect(getPixel(out, 1, 0).a).toBe(0);
  });

  it("hides the clipped layers when the base is hidden", () => {
    const out = evaluateLayerStack(
      [raster("base", { hidden: true }), raster("top", { clipToBelow: true })],
      new Map([
        ["base", base()],
        ["top", solid(255, 255, 255)],
      ]),
      options,
    );
    expect(getPixel(out, 0, 0).a).toBe(0);
  });
});

describe("performance", () => {
  it("evaluates three layers on 512x512 under the bound", () => {
    const a = createPixelBuffer(512, 512, { r: 10, g: 20, b: 30, a: 255 });
    const b = createPixelBuffer(512, 512, { r: 200, g: 100, b: 50, a: 200 });
    const started = performance.now();
    const out = evaluateLayerStack(
      [raster("a"), raster("b", { blendMode: DesignBlendMode.Overlay }), invertLayer()],
      new Map([
        ["a", a],
        ["b", b],
      ]),
      { width: 512, height: 512 },
    );
    expect(performance.now() - started).toBeLessThan(3000);
    expect(getPixel(out, 5, 5).a).toBe(255);
  });
});
