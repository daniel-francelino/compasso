import type { Layer, LayerMaskData, PixelArray, PixelData, Psd } from "ag-psd";
import type { PlanBox, PlanNode, PsdPlan } from "@/lib/shared/design/import/handlers/psd-plan";
import { sanitizeImportName } from "@/lib/shared/design/import/sanitize";
import type { WorkerDocument, WorkerNode } from "@/lib/shared/design/import/worker/protocol";
import { clampByte } from "@/lib/shared/design/raster/numeric";

const COLOR_MODE_CMYK = 4;
const MAX_BLEND_NAME = 40;
const PASS_THROUGH = "pass through";
const NORMAL = "normal";
const BYTE_RANGE = 255;
const BYTE_SHIFT = 8;

export type PsdPixelSource = {
  layerPixels: (layer: Layer) => PixelData | undefined;
  maskPixels: (layer: Layer) => PixelData | undefined;
  compositePixels: (psd: Psd) => PixelData | undefined;
};

export type DecodeProgress = (done: number, total: number) => void;

const byteReader = (data: PixelArray): ((index: number) => number) => {
  if (data instanceof Uint16Array) return (index) => (data[index] ?? 0) >> BYTE_SHIFT;
  if (data instanceof Float32Array) return (index) => clampByte((data[index] ?? 0) * BYTE_RANGE);
  return (index) => data[index] ?? 0;
};

const hasExpectedLength = (pixels: PixelData): boolean =>
  Number.isSafeInteger(pixels.width * pixels.height * 4) &&
  pixels.data.length === pixels.width * pixels.height * 4;

export const cropPixels = (
  source: PixelData,
  origin: { left: number; top: number },
  box: PlanBox,
): Uint8ClampedArray<ArrayBuffer> | null => {
  if (!hasExpectedLength(source)) return null;
  const offsetX = box.left - origin.left;
  const offsetY = box.top - origin.top;
  if (offsetX < 0 || offsetY < 0) return null;
  if (offsetX + box.width > source.width || offsetY + box.height > source.height) return null;
  const out = new Uint8ClampedArray(box.width * box.height * 4);
  const direct = source.data instanceof Uint8ClampedArray || source.data instanceof Uint8Array;
  const read = byteReader(source.data);
  for (let row = 0; row < box.height; row += 1) {
    const from = ((offsetY + row) * source.width + offsetX) * 4;
    const rowLength = box.width * 4;
    if (direct) {
      out.set(source.data.subarray(from, from + rowLength), row * rowLength);
      continue;
    }
    for (let index = 0; index < rowLength; index += 1)
      out[row * rowLength + index] = read(from + index);
  }
  return out;
};

const maskValueAt = (
  mask: LayerMaskData,
  pixels: PixelData | undefined,
  read: ((index: number) => number) | null,
  point: { x: number; y: number },
): number => {
  const fallback = mask.defaultColor ?? BYTE_RANGE;
  if (pixels === undefined || read === null) return fallback;
  const column = point.x - (mask.left ?? 0);
  const row = point.y - (mask.top ?? 0);
  const inside = column >= 0 && row >= 0 && column < pixels.width && row < pixels.height;
  return inside ? read((row * pixels.width + column) * 4) : fallback;
};

export const bakeMask = (
  data: Uint8ClampedArray,
  box: PlanBox,
  mask: LayerMaskData,
  pixels: PixelData | undefined,
): boolean => {
  if (mask.disabled === true) return false;
  if (pixels !== undefined && !hasExpectedLength(pixels)) return false;
  if (pixels === undefined && (mask.defaultColor ?? BYTE_RANGE) === BYTE_RANGE) return false;
  const read = pixels === undefined ? null : byteReader(pixels.data);
  for (let row = 0; row < box.height; row += 1) {
    for (let column = 0; column < box.width; column += 1) {
      const value = maskValueAt(mask, pixels, read, { x: box.left + column, y: box.top + row });
      const index = (row * box.width + column) * 4 + 3;
      data[index] = Math.round(((data[index] ?? 0) * value) / BYTE_RANGE);
    }
  }
  return true;
};

const hasVisiblePixels = (data: Uint8ClampedArray): boolean => {
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 0) > 0) return true;
  }
  return false;
};

const unit = (value: number | undefined): number => Math.min(1, Math.max(0, value ?? 1));

const describe = (node: PlanNode): Omit<WorkerNode, "box" | "pixels"> => {
  const { layer, group } = node;
  const leafInfo = !group && layer.adjustment === undefined;
  return {
    group,
    depth: node.depth,
    name: sanitizeImportName(layer.name ?? ""),
    hidden: layer.hidden === true,
    opened: layer.opened !== false,
    opacity: unit(layer.opacity),
    fillOpacity: unit(layer.fillOpacity),
    blendMode: (layer.blendMode ?? (group ? PASS_THROUGH : NORMAL)).slice(0, MAX_BLEND_NAME),
    clipping: layer.clipping === true,
    text: leafInfo && layer.text !== undefined,
    smartObject: leafInfo && layer.placedLayer !== undefined,
    effects: leafInfo && layer.effects !== undefined,
    adjustment: !group && layer.adjustment !== undefined,
  };
};

type Decoded = { box: PlanBox; data: Uint8ClampedArray<ArrayBuffer> } | null;

const decodeNode = (node: PlanNode, psd: Psd, source: PsdPixelSource): Decoded => {
  const { box, layer } = node;
  if (box === null) return null;
  const pixels = node.composite ? source.compositePixels(psd) : source.layerPixels(layer);
  if (pixels === undefined) return null;
  const origin = node.composite
    ? { left: 0, top: 0 }
    : { left: layer.left ?? 0, top: layer.top ?? 0 };
  const data = cropPixels(pixels, origin, box);
  if (data === null) return null;
  if (layer.mask !== undefined) {
    bakeMask(data, box, layer.mask, node.decodeMask ? source.maskPixels(layer) : undefined);
  }
  return hasVisiblePixels(data) ? { box, data } : null;
};

export const decodePsd = (
  psd: Psd,
  plan: PsdPlan,
  source: PsdPixelSource,
  progress: DecodeProgress,
): WorkerDocument => {
  const nodes: WorkerNode[] = [];
  let done = 0;
  for (const node of plan.nodes) {
    const decoded = decodeNode(node, psd, source);
    if (node.box !== null) {
      done += 1;
      progress(done, plan.decodeCount);
    }
    nodes.push({
      ...describe(node),
      box: decoded === null ? null : decoded.box,
      pixels: decoded === null ? null : decoded.data.buffer,
    });
  }
  return {
    width: psd.width,
    height: psd.height,
    depthReduced: psd.bitsPerChannel !== undefined && psd.bitsPerChannel !== 8,
    cmyk: psd.colorMode === COLOR_MODE_CMYK,
    flattened: plan.nodes[0]?.composite === true,
    nodes,
  };
};
