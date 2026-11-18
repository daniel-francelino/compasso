import type {
  DesignElement,
  DesignPage,
  ImageElement,
  RasterElement,
} from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignElementKind } from "@/lib/shared/design/types";

export const rasterizedPixelSize = (
  width: number,
  height: number,
): { pixelWidth: number; pixelHeight: number } => {
  const scale = Math.min(1, DESIGN_LIMITS.maxRasterSide / Math.max(width, height));
  return {
    pixelWidth: Math.max(1, Math.round(width * scale)),
    pixelHeight: Math.max(1, Math.round(height * scale)),
  };
};

export const rasterizedElement = (source: ImageElement, id: string): RasterElement => ({
  id,
  kind: DesignElementKind.Raster,
  x: source.x,
  y: source.y,
  width: source.width,
  height: source.height,
  rotation: source.rotation,
  opacity: source.opacity,
  locked: source.locked,
  groupId: source.groupId,
  blendMode: source.blendMode,
  fillOpacity: source.fillOpacity,
  name: source.name,
  hidden: source.hidden,
  parentId: source.parentId,
  clipToBelow: source.clipToBelow,
  mask: source.mask,
  pixelsVersionId: null,
  ...rasterizedPixelSize(source.width, source.height),
});

export const adjustBrightnessContrast = (
  data: Uint8ClampedArray,
  brightness: number,
  contrast: number,
): void => {
  const shift = brightness * 255;
  const adjust = ((contrast + 100) / 100) ** 2;
  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = (data[index + channel] ?? 0) + shift;
      const clamped = Math.min(255, Math.max(0, value));
      data[index + channel] = ((clamped / 255 - 0.5) * adjust + 0.5) * 255;
    }
  }
};

export const replaceElement = (
  page: DesignPage,
  id: string,
  element: DesignElement,
): DesignPage => ({
  ...page,
  elements: page.elements.map((item) => (item.id === id ? element : item)),
});
