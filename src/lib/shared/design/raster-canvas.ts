import { type InheritedLayer, coverCrop } from "@/lib/shared/design/document";
import {
  coverageOfPlaced,
  isMaskActive,
  maskKey,
  maskPlacement,
  maskSignature,
  maskValueAt,
} from "@/lib/shared/design/layer-mask";
import { docToLayerPoint } from "@/lib/shared/design/paint";
import { adjustBrightnessContrast, rasterizedPixelSize } from "@/lib/shared/design/rasterize";
import type {
  DesignElement,
  ImageElement,
  PathElement,
  RasterElement,
} from "@/lib/shared/design/schemas";
import { type SampleSize, sampleColor } from "@/lib/shared/design/raster/fill";
import type { CoverageMask } from "@/lib/shared/design/raster/blend";
import {
  evaluateLayerStack,
  type PipelineLayer,
  PipelineLayerKind,
} from "@/lib/shared/design/raster/pipeline";
import {
  createPixelBuffer,
  type PixelBuffer,
  type RgbaColor,
} from "@/lib/shared/design/raster/pixel-buffer";
import { pathDash } from "@/lib/shared/design/path";
import {
  pathFillStyle,
  pathRasterFrame,
  safePathElement,
} from "@/lib/shared/design/vector/path-paint";
import { splitRasterRuns } from "@/lib/shared/design/raster-runs";
import { RASTER_BYTES_PER_PIXEL, type RasterStore } from "@/lib/shared/design/raster-store";
import {
  DESIGN_LIMITS,
  DesignBlendMode,
  DesignElementKind,
  type PageSize,
} from "@/lib/shared/design/types";

type LayerCanvasEntry = { canvas: HTMLCanvasElement; buffer: PixelBuffer; revision: number };
type PlacedEntry = { key: string; placed: PixelBuffer };
type CoverageEntry = { key: string; coverage: CoverageMask };
type RunEntry = { signature: string; canvas: HTMLCanvasElement; ownerId: string };

const layerCanvases = new WeakMap<RasterStore, Map<string, LayerCanvasEntry>>();
const placedLayers = new WeakMap<RasterStore, Map<string, PlacedEntry>>();
const runCanvases = new WeakMap<RasterStore, Map<string, RunEntry>>();
const coverages = new WeakMap<RasterStore, Map<string, CoverageEntry>>();
const serials = new WeakMap<PixelBuffer, number>();
let nextSerial = 1;
let scratch: HTMLCanvasElement | null = null;

const cacheOf = <T>(owner: WeakMap<RasterStore, Map<string, T>>, store: RasterStore) => {
  const known = owner.get(store);
  if (known !== undefined) return known;
  const created = new Map<string, T>();
  owner.set(store, created);
  return created;
};

const serialOf = (buffer: PixelBuffer): number => {
  const known = serials.get(buffer);
  if (known !== undefined) return known;
  const serial = nextSerial;
  nextSerial += 1;
  serials.set(buffer, serial);
  return serial;
};

const newCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const canvasBytes = (width: number, height: number): number =>
  width * height * RASTER_BYTES_PER_PIXEL;

const imageDataOf = (buffer: PixelBuffer): ImageData => {
  const { data, width, height } = buffer;
  const backing = data.buffer;
  if (!(backing instanceof ArrayBuffer)) {
    return new ImageData(new Uint8ClampedArray(data), width, height);
  }
  return new ImageData(new Uint8ClampedArray(backing, data.byteOffset, data.length), width, height);
};

export const bufferToCanvas = (
  buffer: PixelBuffer,
  into?: HTMLCanvasElement,
): HTMLCanvasElement | null => {
  const canvas = into ?? newCanvas(buffer.width, buffer.height);
  if (canvas.width !== buffer.width) canvas.width = buffer.width;
  if (canvas.height !== buffer.height) canvas.height = buffer.height;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.putImageData(imageDataOf(buffer), 0, 0);
  return canvas;
};

export const MAX_PASTE_BYTES = 25 * 1024 * 1024;

export const imageToBuffer = (
  image: HTMLImageElement,
  maxWidth: number = DESIGN_LIMITS.maxRasterSide,
  maxHeight: number = DESIGN_LIMITS.maxRasterSide,
): PixelBuffer | null => {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width < 1 || height < 1) return null;
  const side = DESIGN_LIMITS.maxRasterSide;
  if (width > Math.min(maxWidth, side) || height > Math.min(maxHeight, side)) return null;
  const canvas = newCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) return null;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height);
  return { width, height, data: pixels.data };
};

export const layerCanvas = (store: RasterStore, id: string): HTMLCanvasElement | null => {
  const buffer = store.get(id);
  if (buffer === undefined) return null;
  const revision = store.revisionOf(id);
  const entries = cacheOf(layerCanvases, store);
  const cached = entries.get(id);
  if (cached !== undefined && cached.buffer === buffer && cached.revision === revision) {
    return cached.canvas;
  }
  const canvas = bufferToCanvas(buffer, cached?.canvas);
  if (canvas === null) return null;
  entries.set(id, { canvas, buffer, revision });
  store.trackDerived(id, "canvas", canvasBytes(buffer.width, buffer.height));
  return canvas;
};

const pageScratch = (size: PageSize): CanvasRenderingContext2D | null => {
  scratch ??= newCanvas(size.width, size.height);
  if (scratch.width !== size.width || scratch.height !== size.height) {
    scratch.width = size.width;
    scratch.height = size.height;
  }
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (context === null) return null;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, size.width, size.height);
  return context;
};

const placeOnPage = (
  element: DesignElement,
  source: HTMLCanvasElement,
  size: PageSize,
): PixelBuffer | null => {
  const context = pageScratch(size);
  if (context === null) return null;
  context.translate(element.x + element.width / 2, element.y + element.height / 2);
  context.rotate((element.rotation * Math.PI) / 180);
  context.drawImage(source, -element.width / 2, -element.height / 2, element.width, element.height);
  const pixels = context.getImageData(0, 0, size.width, size.height);
  return { width: size.width, height: size.height, data: pixels.data };
};

const frameKey = (element: DesignElement, size: PageSize): string =>
  `${element.x},${element.y},${element.width},${element.height},${element.rotation}@${size.width}x${size.height}`;

const placedLayer = (
  store: RasterStore,
  element: DesignElement,
  size: PageSize,
  storeKey: string = element.id,
): PixelBuffer | null => {
  const buffer = store.get(storeKey);
  if (buffer === undefined) return null;
  const key = `${serialOf(buffer)}:${store.revisionOf(storeKey)}:${frameKey(element, size)}`;
  const entries = cacheOf(placedLayers, store);
  const cached = entries.get(storeKey);
  if (cached !== undefined && cached.key === key) return cached.placed;
  const source = layerCanvas(store, storeKey);
  const placed = source === null ? null : placeOnPage(element, source, size);
  if (placed === null) return null;
  entries.set(storeKey, { key, placed });
  store.trackDerived(storeKey, "placed", canvasBytes(size.width, size.height));
  return placed;
};

const pageCoverage = (
  store: RasterStore,
  element: DesignElement,
  size: PageSize,
): CoverageMask | null => {
  if (!isMaskActive(element)) return null;
  const storeKey = maskKey(element.id);
  const buffer = store.get(storeKey);
  if (buffer === undefined) return null;
  const key = `${serialOf(buffer)}:${store.revisionOf(storeKey)}:${frameKey(element, size)}`;
  const entries = cacheOf(coverages, store);
  const cached = entries.get(storeKey);
  if (cached !== undefined && cached.key === key) return cached.coverage;
  const placed = placedLayer(store, element, size, storeKey);
  if (placed === null) return null;
  const coverage = coverageOfPlaced(placed);
  entries.set(storeKey, { key, coverage });
  store.trackDerived(storeKey, "coverage", size.width * size.height);
  return coverage;
};

const windowCoverage = (
  store: RasterStore,
  element: DesignElement,
  x: number,
  y: number,
  size: SampleSize,
): CoverageMask | null => {
  const buffer = isMaskActive(element) ? store.get(maskKey(element.id)) : undefined;
  if (buffer === undefined) return null;
  const placement = maskPlacement(element, buffer);
  const data = new Uint8Array(size * size);
  const reach = (size - 1) / 2;
  for (let wy = 0; wy < size; wy += 1) {
    for (let wx = 0; wx < size; wx += 1) {
      const point = { x: x - reach + wx + 0.5, y: y - reach + wy + 0.5 };
      const local = docToLayerPoint(placement, point);
      data[wy * size + wx] = maskValueAt(buffer, Math.floor(local.x), Math.floor(local.y));
    }
  }
  return { width: size, height: size, data };
};

const pipelineBase = (layer: InheritedLayer, mask: CoverageMask | null) => ({
  id: layer.element.id,
  hidden: layer.hidden,
  opacity: layer.opacity,
  fillOpacity: layer.element.fillOpacity,
  blendMode: layer.element.blendMode,
  clipToBelow: layer.element.clipToBelow,
  mask,
});

type PipelineInput = { stack: PipelineLayer[]; sources: Map<string, PixelBuffer> };

const buildPipeline = (
  layers: readonly InheritedLayer[],
  sourceOf: (element: RasterElement) => PixelBuffer | null,
  maskOf: (element: DesignElement) => CoverageMask | null,
): PipelineInput => {
  const sources = new Map<string, PixelBuffer>();
  const stack: PipelineLayer[] = [];
  for (const layer of layers) {
    const element = layer.element;
    if (element.kind === DesignElementKind.Adjustment) {
      stack.push({
        ...pipelineBase(layer, maskOf(element)),
        kind: PipelineLayerKind.Adjustment,
        adjustment: element.adjustment,
      });
      continue;
    }
    if (element.kind !== DesignElementKind.Raster || layer.hidden) continue;
    const source = sourceOf(element);
    if (source === null) continue;
    sources.set(element.id, source);
    stack.push({
      ...pipelineBase(layer, maskOf(element)),
      kind: PipelineLayerKind.Raster,
      sourceId: element.id,
      x: 0,
      y: 0,
    });
  }
  return { stack, sources };
};

const runSignature = (
  layers: readonly InheritedLayer[],
  store: RasterStore,
  size: PageSize,
): string =>
  layers
    .map((layer) => {
      const element = layer.element;
      const mask = store.get(maskKey(element.id));
      const maskPart =
        mask === undefined
          ? "m-"
          : maskSignature(element, serialOf(mask), store.revisionOf(maskKey(element.id)));
      const base = `${element.id}|${layer.hidden}|${layer.opacity}|${element.fillOpacity}|${element.blendMode}|${element.clipToBelow}|${maskPart}`;
      if (element.kind === DesignElementKind.Adjustment) {
        return `${base}|${JSON.stringify(element.adjustment)}`;
      }
      const buffer = store.get(element.id);
      const identity = buffer === undefined ? "none" : serialOf(buffer);
      return `${base}|${identity}:${store.revisionOf(element.id)}:${frameKey(element, size)}`;
    })
    .join(";");

const pruneReleased = (store: RasterStore): void => {
  for (const id of cacheOf(layerCanvases, store).keys()) {
    if (!store.has(id)) cacheOf(layerCanvases, store).delete(id);
  }
  for (const id of cacheOf(placedLayers, store).keys()) {
    if (!store.has(id)) cacheOf(placedLayers, store).delete(id);
  }
  for (const id of cacheOf(coverages, store).keys()) {
    if (!store.has(id)) cacheOf(coverages, store).delete(id);
  }
  const runs = cacheOf(runCanvases, store);
  for (const [key, entry] of runs) {
    if (!store.has(entry.ownerId)) runs.delete(key);
  }
};

const firstRasterId = (layers: readonly InheritedLayer[]): string | null =>
  layers.find((layer) => layer.element.kind === DesignElementKind.Raster)?.element.id ?? null;

const viewedMask = (
  layers: readonly InheritedLayer[],
  store: RasterStore,
  size: PageSize,
  maskView: string | null,
): { element: DesignElement; signature: string } | null => {
  const element = layers.find((layer) => layer.element.id === maskView)?.element;
  const buffer = element === undefined ? undefined : store.get(maskKey(element.id));
  if (element === undefined || buffer === undefined) return null;
  const revision = store.revisionOf(maskKey(element.id));
  return { element, signature: `view|${serialOf(buffer)}:${revision}:${frameKey(element, size)}` };
};

const storeRun = (
  runs: Map<string, RunEntry>,
  key: string,
  entry: { signature: string; ownerId: string },
  placed: PixelBuffer | null,
  into: HTMLCanvasElement | undefined,
): HTMLCanvasElement | null => {
  const canvas = placed === null ? null : bufferToCanvas(placed, into);
  if (canvas === null) return null;
  for (const [other, existing] of runs) {
    if (other !== key && existing.ownerId === entry.ownerId) runs.delete(other);
  }
  runs.set(key, { ...entry, canvas });
  return canvas;
};

export const renderRun = (
  layers: readonly InheritedLayer[],
  store: RasterStore,
  size: PageSize,
  maskView: string | null = null,
): HTMLCanvasElement | null => {
  const ownerId = firstRasterId(layers);
  if (ownerId === null) return null;
  pruneReleased(store);
  const runs = cacheOf(runCanvases, store);
  const key = `${ownerId}@${size.width}x${size.height}`;
  const viewed = viewedMask(layers, store, size, maskView);
  const signature = viewed === null ? runSignature(layers, store, size) : viewed.signature;
  const cached = runs.get(key);
  if (cached !== undefined && cached.signature === signature) return cached.canvas;
  if (viewed !== null) {
    const placedView = placedLayer(store, viewed.element, size, maskKey(viewed.element.id));
    return storeRun(runs, key, { signature, ownerId }, placedView, cached?.canvas);
  }
  const { stack, sources } = buildPipeline(
    layers,
    (element) => placedLayer(store, element, size),
    (element) => pageCoverage(store, element, size),
  );
  const canvas = bufferToCanvas(evaluateLayerStack(stack, sources, size), cached?.canvas);
  if (canvas === null) return null;
  runs.set(key, { signature, canvas, ownerId });
  store.trackDerived(ownerId, `run:${key}`, canvasBytes(size.width, size.height));
  return canvas;
};

const windowSource = (
  element: RasterElement,
  buffer: PixelBuffer,
  x: number,
  y: number,
  size: SampleSize,
): PixelBuffer => {
  const out = createPixelBuffer(size, size);
  const reach = (size - 1) / 2;
  for (let wy = 0; wy < size; wy += 1) {
    for (let wx = 0; wx < size; wx += 1) {
      const local = docToLayerPoint(element, { x: x - reach + wx + 0.5, y: y - reach + wy + 0.5 });
      const lx = Math.floor(local.x);
      const ly = Math.floor(local.y);
      const inside = lx >= 0 && ly >= 0 && lx < buffer.width && ly < buffer.height;
      if (!inside) continue;
      const from = (ly * buffer.width + lx) * 4;
      out.data.set(buffer.data.subarray(from, from + 4), (wy * size + wx) * 4);
    }
  }
  return out;
};

export const sampleCompositeAt = (
  layers: readonly InheritedLayer[],
  store: RasterStore,
  x: number,
  y: number,
  size: SampleSize,
): RgbaColor | null => {
  const options = { width: size, height: size };
  const runStack: PipelineLayer[] = [];
  const runSources = new Map<string, PixelBuffer>();
  for (const [index, run] of splitRasterRuns(layers).entries()) {
    const { stack, sources } = buildPipeline(
      run.layers,
      (element) => {
        const buffer = store.get(element.id);
        return buffer === undefined ? null : windowSource(element, buffer, x, y, size);
      },
      (element) => windowCoverage(store, element, x, y, size),
    );
    const id = `run-${index}`;
    runSources.set(id, evaluateLayerStack(stack, sources, options));
    runStack.push({
      id,
      hidden: false,
      opacity: 1,
      fillOpacity: 1,
      blendMode: DesignBlendMode.Normal,
      clipToBelow: false,
      mask: null,
      kind: PipelineLayerKind.Raster,
      sourceId: id,
      x: 0,
      y: 0,
    });
  }
  const composite = evaluateLayerStack(runStack, runSources, options);
  const reach = (size - 1) / 2;
  return sampleColor(composite, reach, reach, size);
};

export const rasterizeImage = (
  element: ImageElement,
  image: HTMLImageElement,
): PixelBuffer | null => {
  const { pixelWidth, pixelHeight } = rasterizedPixelSize(element.width, element.height);
  const canvas = newCanvas(pixelWidth, pixelHeight);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) return null;
  const crop = coverCrop(
    { width: image.naturalWidth, height: image.naturalHeight },
    { width: element.width, height: element.height },
    element.zoom,
    element.focusX,
    element.focusY,
  );
  context.translate(element.flipX ? pixelWidth : 0, element.flipY ? pixelHeight : 0);
  context.scale(element.flipX ? -1 : 1, element.flipY ? -1 : 1);
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, pixelWidth, pixelHeight);
  const pixels = context.getImageData(0, 0, pixelWidth, pixelHeight);
  adjustBrightnessContrast(pixels.data, element.brightness, element.contrast);
  return { width: pixelWidth, height: pixelHeight, data: pixels.data };
};

export const rasterizePath = (source: PathElement): PixelBuffer | null => {
  const element = safePathElement(source);
  if (element === null) return null;
  const frame = pathRasterFrame(element);
  const { pixelWidth, pixelHeight } = rasterizedPixelSize(frame.width, frame.height);
  const canvas = newCanvas(pixelWidth, pixelHeight);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) return null;
  const pad = (frame.width - element.width) / 2;
  context.scale(pixelWidth / frame.width, pixelHeight / frame.height);
  context.translate(pad, pad);
  const shape = new Path2D();
  shape.addPath(
    new Path2D(element.d),
    new DOMMatrix([
      element.width / element.viewWidth,
      0,
      0,
      element.height / element.viewHeight,
      0,
      0,
    ]),
  );
  if (element.fill !== null) {
    context.fillStyle = pathFillStyle(context, element.fill, element);
    context.fill(shape, element.fillRule);
  }
  if (element.stroke !== null) {
    context.strokeStyle = element.stroke.color;
    context.lineWidth = element.stroke.width;
    context.lineCap = element.stroke.cap;
    context.lineJoin = element.stroke.join;
    context.miterLimit = element.stroke.miterLimit;
    context.setLineDash(pathDash(element.stroke));
    context.stroke(shape);
  }
  const pixels = context.getImageData(0, 0, pixelWidth, pixelHeight);
  return { width: pixelWidth, height: pixelHeight, data: pixels.data };
};

export const bufferToPng = (buffer: PixelBuffer): Promise<Blob | null> => {
  const canvas = bufferToCanvas(buffer);
  if (canvas === null) return Promise.resolve(null);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
};

export const blobToBuffer = async (
  blob: Blob,
  canAllocate: (width: number, height: number) => boolean = () => true,
): Promise<PixelBuffer | null> => {
  if (blob.size > MAX_PASTE_BYTES) return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    const side = DESIGN_LIMITS.maxRasterSide;
    if (width < 1 || height < 1 || width > side || height > side) return null;
    if (!canAllocate(width, height)) return null;
    const canvas = newCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) return null;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    return { width, height, data: pixels.data };
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
};
