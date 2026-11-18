import type { AdjustmentParams } from "@/lib/shared/design/raster/adjustment-schemas";
import { applyAdjustmentTo } from "@/lib/shared/design/raster/adjustments";
import { blendColors, blendOnto, type CoverageMask } from "@/lib/shared/design/raster/blend";
import { at, clamp01 } from "@/lib/shared/design/raster/numeric";
import {
  createPixelBuffer,
  type PixelBuffer,
  type RgbaColor,
} from "@/lib/shared/design/raster/pixel-buffer";
import { DesignBlendMode } from "@/lib/shared/design/types";
import type { ValueOf } from "@/lib/shared/utils";

export const PipelineLayerKind = { Raster: "raster", Adjustment: "adjustment" } as const;
export type PipelineLayerKind = ValueOf<typeof PipelineLayerKind>;

type PipelineLayerBase = {
  id: string;
  hidden: boolean;
  opacity: number;
  fillOpacity: number;
  blendMode: DesignBlendMode;
  clipToBelow: boolean;
  mask: CoverageMask | null;
};

export type PipelineRasterLayer = PipelineLayerBase & {
  kind: typeof PipelineLayerKind.Raster;
  sourceId: string;
  x: number;
  y: number;
};

export type PipelineAdjustmentLayer = PipelineLayerBase & {
  kind: typeof PipelineLayerKind.Adjustment;
  adjustment: AdjustmentParams;
};

export type PipelineLayer = PipelineRasterLayer | PipelineAdjustmentLayer;

export type PipelineOptions = { width: number; height: number; background?: RgbaColor | null };

const cb = new Float64Array(3);
const cs = new Float64Array(3);
const mixed = new Float64Array(3);

const applyAdjustmentLayer = (
  out: PixelBuffer,
  layer: PipelineAdjustmentLayer,
  baseAlpha: Uint8ClampedArray,
  adjusted: PixelBuffer,
): void => {
  applyAdjustmentTo(out, adjusted, layer.adjustment);
  const gain = clamp01(layer.opacity) * clamp01(layer.fillOpacity);
  const normal = layer.blendMode === DesignBlendMode.Normal;
  for (let p = 0; p < out.width * out.height; p += 1) {
    const i = p * 4;
    if (at(out.data, i + 3) === 0) continue;
    const mask = layer.mask === null ? 1 : at(layer.mask.data, p) / 255;
    const clip = layer.clipToBelow ? at(baseAlpha, p) / 255 : 1;
    const strength = gain * mask * clip;
    if (strength <= 0) continue;
    for (let c = 0; c < 3; c += 1) {
      cb[c] = at(out.data, i + c) / 255;
      cs[c] = at(adjusted.data, i + c) / 255;
    }
    if (normal) mixed.set(cs);
    else blendColors(layer.blendMode, cb, cs, mixed);
    for (let c = 0; c < 3; c += 1) {
      out.data[i + c] = (at(cb, c) + (at(mixed, c) - at(cb, c)) * strength) * 255;
    }
  }
};

const recordBaseAlpha = (
  baseAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  layer: PipelineRasterLayer,
  source: PixelBuffer,
): void => {
  baseAlpha.fill(0);
  for (let sy = 0; sy < source.height; sy += 1) {
    const y = sy + layer.y;
    if (y < 0 || y >= height) continue;
    for (let sx = 0; sx < source.width; sx += 1) {
      const x = sx + layer.x;
      if (x < 0 || x >= width) continue;
      const mask = layer.mask === null ? 1 : at(layer.mask.data, y * width + x) / 255;
      baseAlpha[y * width + x] = at(source.data, (sy * source.width + sx) * 4 + 3) * mask;
    }
  }
};

export const evaluateLayerStack = (
  layers: readonly PipelineLayer[],
  sources: ReadonlyMap<string, PixelBuffer>,
  options: PipelineOptions,
): PixelBuffer => {
  const { width, height } = options;
  const out = createPixelBuffer(width, height, options.background ?? undefined);
  const baseAlpha = new Uint8ClampedArray(width * height);
  let adjusted: PixelBuffer | null = null;
  for (const layer of layers) {
    const source =
      layer.kind === PipelineLayerKind.Raster ? sources.get(layer.sourceId) : undefined;
    const skipped =
      layer.hidden || (layer.kind === PipelineLayerKind.Raster && source === undefined);
    if (skipped && !layer.clipToBelow) baseAlpha.fill(0);
    if (skipped) continue;
    if (layer.kind === PipelineLayerKind.Adjustment) {
      adjusted = adjusted ?? createPixelBuffer(width, height);
      applyAdjustmentLayer(out, layer, baseAlpha, adjusted);
      continue;
    }
    if (source === undefined) continue;
    const clip = layer.clipToBelow ? { width, height, data: baseAlpha } : null;
    blendOnto(out, source, {
      mode: layer.blendMode,
      opacity: layer.opacity,
      fillOpacity: layer.fillOpacity,
      mask: layer.mask,
      x: layer.x,
      y: layer.y,
      clip,
    });
    if (!layer.clipToBelow) recordBaseAlpha(baseAlpha, width, height, layer, source);
  }
  return out;
};
