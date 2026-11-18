import type { Layer, Psd } from "ag-psd";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import { DesignImportFailure } from "@/lib/shared/design/import/types";

const COLOR_MODE_CMYK = 4;
const RGBA_CHANNELS = 4n;
const CMYK_DECODE_CHANNELS = 9n;
const MAX_SAMPLE_BYTES = 4n;

export type PlanBox = { left: number; top: number; width: number; height: number };

export type PlanNode = {
  layer: Layer;
  depth: number;
  group: boolean;
  composite: boolean;
  box: PlanBox | null;
  decodeMask: boolean;
};

export type PsdPlan = { nodes: PlanNode[]; plannedBytes: number; decodeCount: number };

export type PlanLimits = {
  capacityElements: number;
  remainingBytes: number;
  maxLayerSide: number;
};

export type PlanResult = { ok: true; plan: PsdPlan } | { ok: false; failure: DesignImportFailure };

type Frame = { layers: readonly Layer[]; index: number; depth: number };

const refuse = (failure: DesignImportFailure): PlanResult => ({ ok: false, failure });

const sampleBytes = (depth: number): bigint =>
  depth >= 32 ? MAX_SAMPLE_BYTES : depth === 16 ? 2n : 1n;

const extent = (start: number | undefined, end: number | undefined): number | null => {
  const a = start ?? 0;
  const b = end ?? 0;
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null;
  return Math.max(0, b - a);
};

const decodedBytes = (width: number, height: number, channels: bigint, depth: number): bigint =>
  BigInt(width) * BigInt(height) * channels * sampleBytes(depth);

const intersect = (
  layer: { left: number; top: number; width: number; height: number },
  page: { width: number; height: number },
): PlanBox | null => {
  const left = Math.max(0, layer.left);
  const top = Math.max(0, layer.top);
  const right = Math.min(page.width, layer.left + layer.width);
  const bottom = Math.min(page.height, layer.top + layer.height);
  return right - left < 1 || bottom - top < 1
    ? null
    : { left, top, width: right - left, height: bottom - top };
};

export const planBytes = (box: PlanBox): number => rasterBytes(box.width, box.height);

type Budget = { capacity: number; remaining: bigint; planned: number; leaves: number };

const groupNode = (layer: Layer, depth: number): PlanNode => ({
  layer,
  depth,
  group: true,
  composite: false,
  box: null,
  decodeMask: false,
});

const leafNode = (layer: Layer, depth: number, box: PlanBox | null, mask: boolean): PlanNode => ({
  layer,
  depth,
  group: false,
  composite: false,
  box,
  decodeMask: mask,
});

const maskBytes = (
  layer: Layer,
  depth: number,
  limits: PlanLimits,
): { bytes: bigint } | { failure: DesignImportFailure } | null => {
  const mask = layer.mask;
  if (mask === undefined || mask.disabled === true) return null;
  const width = extent(mask.left, mask.right);
  const height = extent(mask.top, mask.bottom);
  if (width === null || height === null) return { failure: DesignImportFailure.LayerTooLarge };
  if (width === 0 || height === 0) return null;
  if (width > limits.maxLayerSide || height > limits.maxLayerSide) {
    return { failure: DesignImportFailure.LayerTooLarge };
  }
  return { bytes: decodedBytes(width, height, RGBA_CHANNELS, depth) };
};

const planLeaf = (
  layer: Layer,
  depth: number,
  page: { width: number; height: number },
  budget: Budget,
  limits: PlanLimits,
): { node: PlanNode } | { failure: DesignImportFailure } => {
  const width = extent(layer.left, layer.right);
  const height = extent(layer.top, layer.bottom);
  if (layer.adjustment !== undefined || layer.rawData === undefined) {
    return { node: leafNode(layer, depth, null, false) };
  }
  if (width === null || height === null) return { failure: DesignImportFailure.LayerTooLarge };
  if (width === 0 || height === 0) return { node: leafNode(layer, depth, null, false) };
  if (width > limits.maxLayerSide || height > limits.maxLayerSide) {
    return { failure: DesignImportFailure.LayerTooLarge };
  }
  const { bitsPerChannel, colorMode } = layer.rawData;
  const channels = colorMode === COLOR_MODE_CMYK ? CMYK_DECODE_CHANNELS : RGBA_CHANNELS;
  const layerBytes = decodedBytes(width, height, channels, bitsPerChannel);
  if (BigInt(budget.planned) + layerBytes > budget.remaining) {
    return { failure: DesignImportFailure.Memory };
  }
  const box = intersect({ left: layer.left ?? 0, top: layer.top ?? 0, width, height }, page);
  if (box === null) return { node: leafNode(layer, depth, null, false) };
  budget.leaves += 1;
  if (budget.leaves > budget.capacity) return { failure: DesignImportFailure.TooManyLayers };
  const mask = maskBytes(layer, bitsPerChannel, limits);
  if (mask !== null && "failure" in mask) return { failure: mask.failure };
  const peak =
    BigInt(budget.planned) +
    layerBytes +
    BigInt(planBytes(box)) +
    (mask === null ? 0n : mask.bytes);
  if (peak > budget.remaining) return { failure: DesignImportFailure.Memory };
  budget.planned += planBytes(box);
  return { node: leafNode(layer, depth, box, mask !== null) };
};

const planComposite = (psd: Psd, budget: Budget): PlanResult => {
  const page = { left: 0, top: 0, width: psd.width, height: psd.height };
  const depth = psd.bitsPerChannel ?? 8;
  const channels = psd.colorMode === COLOR_MODE_CMYK ? CMYK_DECODE_CHANNELS : RGBA_CHANNELS;
  const peak = decodedBytes(page.width, page.height, channels, depth) + BigInt(planBytes(page));
  if (peak > budget.remaining) {
    return refuse(DesignImportFailure.Memory);
  }
  if (budget.capacity < 1) return refuse(DesignImportFailure.TooManyLayers);
  const node: PlanNode = {
    layer: { name: "Imagem" },
    depth: 0,
    group: false,
    composite: true,
    box: page,
    decodeMask: false,
  };
  return { ok: true, plan: { nodes: [node], plannedBytes: planBytes(page), decodeCount: 1 } };
};

const newBudget = (limits: PlanLimits): Budget => ({
  capacity: limits.capacityElements,
  remaining: BigInt(Math.max(0, limits.remainingBytes)),
  planned: 0,
  leaves: 0,
});

export const planFlattened = (psd: Psd, limits: PlanLimits): PlanResult =>
  psd.rawCompositeData === undefined
    ? refuse(DesignImportFailure.NoLayers)
    : planComposite(psd, newBudget(limits));

export const planPsd = (psd: Psd, limits: PlanLimits): PlanResult => {
  const page = { width: psd.width, height: psd.height };
  const budget = newBudget(limits);
  const nodes: PlanNode[] = [];
  const stack: Frame[] = [{ layers: psd.children ?? [], index: 0, depth: 0 }];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const layer = frame?.layers[frame.index];
    if (frame === undefined || layer === undefined) {
      stack.pop();
      continue;
    }
    frame.index += 1;
    if (layer.children !== undefined) {
      nodes.push(groupNode(layer, frame.depth));
      stack.push({ layers: layer.children, index: 0, depth: frame.depth + 1 });
      continue;
    }
    const planned = planLeaf(layer, frame.depth, page, budget, limits);
    if ("failure" in planned) return refuse(planned.failure);
    nodes.push(planned.node);
  }
  if (budget.leaves === 0 && psd.rawCompositeData !== undefined) return planComposite(psd, budget);
  const decodeCount = nodes.filter((node) => node.box !== null).length;
  return { ok: true, plan: { nodes, plannedBytes: budget.planned, decodeCount } };
};
