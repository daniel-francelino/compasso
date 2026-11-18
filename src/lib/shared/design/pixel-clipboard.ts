import { at } from "@/lib/shared/design/raster/numeric";
import {
  type PixelBuffer,
  type Rect,
  createPixelBuffer,
} from "@/lib/shared/design/raster/pixel-buffer";
import { type SelectionMask, maskBoundingBox } from "@/lib/shared/design/raster/selection";
import { createRasterLayer } from "@/lib/shared/design/document";
import type { DesignPage, RasterElement } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, type PageSize } from "@/lib/shared/design/types";

export type ClipPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type PixelClip = {
  buffer: PixelBuffer;
  placement: ClipPlacement;
  systemBytes: number | null;
};

export type ClipLayer = ClipPlacement & { pixelWidth: number; pixelHeight: number };

export const CUT_LABEL = "Recortar";
export const PASTE_LABEL = "Colar";
export const LAYER_VIA_COPY_LABEL = "Camada via cópia";
export const LAYER_VIA_CUT_LABEL = "Camada via recorte";
export const NO_PIXELS_TO_COPY = "Selecione uma camada de pixels para copiar.";
export const NOTHING_TO_PASTE = "Nada para colar.";
export const PASTE_TOO_LARGE = "A imagem colada passa de 4096 px em um dos lados.";
export const NOTHING_SELECTED = "Não há pixels na seleção.";

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const copyRegion = (
  source: PixelBuffer,
  mask: SelectionMask | null,
): { buffer: PixelBuffer; region: Rect } | null => {
  const region =
    mask === null
      ? { x: 0, y: 0, width: source.width, height: source.height }
      : maskBoundingBox(mask);
  if (region === null) return null;
  const buffer = createPixelBuffer(region.width, region.height);
  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      const from = ((region.y + y) * source.width + region.x + x) * 4;
      const to = (y * region.width + x) * 4;
      const weight =
        mask === null ? 255 : at(mask.data, (region.y + y) * mask.width + region.x + x);
      buffer.data[to] = at(source.data, from);
      buffer.data[to + 1] = at(source.data, from + 1);
      buffer.data[to + 2] = at(source.data, from + 2);
      buffer.data[to + 3] = Math.round((at(source.data, from + 3) * weight) / 255);
    }
  }
  return { buffer, region };
};

export const regionPlacement = (layer: ClipLayer, region: Rect): ClipPlacement => {
  const scaleX = layer.width / layer.pixelWidth;
  const scaleY = layer.height / layer.pixelHeight;
  const radians = (layer.rotation * Math.PI) / 180;
  const u = (region.x + region.width / 2 - layer.pixelWidth / 2) * scaleX;
  const v = (region.y + region.height / 2 - layer.pixelHeight / 2) * scaleY;
  const centerX = layer.x + layer.width / 2 + u * Math.cos(radians) - v * Math.sin(radians);
  const centerY = layer.y + layer.height / 2 + u * Math.sin(radians) + v * Math.cos(radians);
  const width = Math.max(DESIGN_LIMITS.minSize, round2(region.width * scaleX));
  const height = Math.max(DESIGN_LIMITS.minSize, round2(region.height * scaleY));
  return {
    x: round2(centerX - width / 2),
    y: round2(centerY - height / 2),
    width,
    height,
    rotation: layer.rotation,
  };
};

export const centerPlacement = (
  placement: ClipPlacement,
  center: { x: number; y: number },
): ClipPlacement => ({
  ...placement,
  x: round2(center.x - placement.width / 2),
  y: round2(center.y - placement.height / 2),
});

export const fittedPlacement = (pixels: PageSize, page: PageSize): ClipPlacement => {
  const scale = Math.min(1, page.width / pixels.width, page.height / pixels.height);
  const width = Math.max(DESIGN_LIMITS.minSize, Math.round(pixels.width * scale));
  const height = Math.max(DESIGN_LIMITS.minSize, Math.round(pixels.height * scale));
  return {
    x: Math.round((page.width - width) / 2),
    y: Math.round((page.height - height) / 2),
    width,
    height,
    rotation: 0,
  };
};

export const exceedsRasterSide = (buffer: PixelBuffer): boolean =>
  buffer.width > DESIGN_LIMITS.maxRasterSide || buffer.height > DESIGN_LIMITS.maxRasterSide;

export const pasteCenter = (
  size: PageSize,
  mask: SelectionMask | null,
): { x: number; y: number } => {
  const box = mask === null ? null : maskBoundingBox(mask);
  if (box === null) return { x: size.width / 2, y: size.height / 2 };
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

export const pastedLayer = (
  id: string,
  page: DesignPage,
  size: PageSize,
  buffer: PixelBuffer,
  placement: ClipPlacement,
): RasterElement => ({
  ...createRasterLayer(id, page, size),
  ...placement,
  pixelWidth: buffer.width,
  pixelHeight: buffer.height,
});

export const systemMatches = (clip: PixelClip | null, bytes: number): boolean =>
  clip !== null && clip.systemBytes !== null && clip.systemBytes === bytes;
