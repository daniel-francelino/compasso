import type { InheritedLayer } from "@/lib/shared/design/document";
import type { DesignElement } from "@/lib/shared/design/schemas";
import {
  evaluateLayerStack,
  type PipelineLayer,
  PipelineLayerKind,
} from "@/lib/shared/design/raster/pipeline";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import type { RasterStore } from "@/lib/shared/design/raster-store";
import { DesignElementKind, type PageSize } from "@/lib/shared/design/types";

type CachedCanvas = { revision: number; canvas: HTMLCanvasElement };

const cache = new WeakMap<PixelBuffer, CachedCanvas>();

const newCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const bufferToCanvas = (buffer: PixelBuffer): HTMLCanvasElement | null => {
  const canvas = newCanvas(buffer.width, buffer.height);
  const context = canvas.getContext("2d");
  if (context === null) return null;
  const pixels = new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height);
  context.putImageData(pixels, 0, 0);
  return canvas;
};

export const imageToBuffer = (image: HTMLImageElement): PixelBuffer | null => {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width < 1 || height < 1) return null;
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
  const cached = cache.get(buffer);
  if (cached !== undefined && cached.revision === revision) return cached.canvas;
  const canvas = bufferToCanvas(buffer);
  if (canvas === null) return null;
  cache.set(buffer, { revision, canvas });
  return canvas;
};

const placeOnPage = (
  element: DesignElement,
  source: HTMLCanvasElement,
  size: PageSize,
): PixelBuffer | null => {
  const target = newCanvas(size.width, size.height);
  const context = target.getContext("2d", { willReadFrequently: true });
  if (context === null) return null;
  context.translate(element.x + element.width / 2, element.y + element.height / 2);
  context.rotate((element.rotation * Math.PI) / 180);
  context.drawImage(source, -element.width / 2, -element.height / 2, element.width, element.height);
  const pixels = context.getImageData(0, 0, size.width, size.height);
  return { width: size.width, height: size.height, data: pixels.data };
};

const pipelineBase = (layer: InheritedLayer) => ({
  id: layer.element.id,
  hidden: layer.hidden,
  opacity: layer.opacity,
  fillOpacity: layer.element.fillOpacity,
  blendMode: layer.element.blendMode,
  clipToBelow: layer.element.clipToBelow,
  mask: null,
});

export const renderStack = (
  layers: readonly InheritedLayer[],
  store: RasterStore,
  size: PageSize,
): HTMLCanvasElement | null => {
  const sources = new Map<string, PixelBuffer>();
  const stack: PipelineLayer[] = [];
  for (const layer of layers) {
    const element = layer.element;
    if (element.kind === DesignElementKind.Adjustment) {
      stack.push({
        ...pipelineBase(layer),
        kind: PipelineLayerKind.Adjustment,
        adjustment: element.adjustment,
      });
      continue;
    }
    if (element.kind !== DesignElementKind.Raster || layer.hidden) continue;
    const canvas = layerCanvas(store, element.id);
    const placed = canvas === null ? null : placeOnPage(element, canvas, size);
    if (placed === null) continue;
    sources.set(element.id, placed);
    stack.push({
      ...pipelineBase(layer),
      kind: PipelineLayerKind.Raster,
      sourceId: element.id,
      x: 0,
      y: 0,
    });
  }
  return bufferToCanvas(evaluateLayerStack(stack, sources, size));
};
