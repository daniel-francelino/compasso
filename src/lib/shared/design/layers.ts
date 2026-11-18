import type { DesignElement, DesignPage } from "@/lib/shared/design/schemas";
import { DESIGN_ELEMENT_LABEL, DesignElementKind } from "@/lib/shared/design/types";

const SNIPPET = 28;

export const layerLabel = (element: DesignElement): string => {
  const own = element.name.trim();
  if (own !== "") return own;
  const kind = DESIGN_ELEMENT_LABEL[element.kind];
  const detail =
    element.kind === DesignElementKind.Text
      ? element.text.trim().replace(/\s+/g, " ")
      : element.kind === DesignElementKind.Image
        ? element.alt.trim()
        : "";
  if (detail === "") return kind;
  return `${kind}: ${detail.length > SNIPPET ? `${detail.slice(0, SNIPPET)}…` : detail}`;
};

export const moveLayerTo = (page: DesignPage, id: string, target: number): DesignPage => {
  const index = page.elements.findIndex((element) => element.id === id);
  const element = page.elements[index];
  if (element === undefined) return page;
  const clamped = Math.min(page.elements.length - 1, Math.max(0, target));
  if (clamped === index) return page;
  const elements = page.elements.filter((item) => item.id !== id);
  elements.splice(clamped, 0, element);
  return { ...page, elements };
};

export const dropTargetIndex = (
  count: number,
  fromDisplay: number,
  insertDisplay: number,
): number => {
  const finalDisplay = insertDisplay > fromDisplay ? insertDisplay - 1 : insertDisplay;
  return count - 1 - finalDisplay;
};

export const THUMBNAIL_SIDE = 32;

export const thumbnailBox = (
  pixelWidth: number,
  pixelHeight: number,
  side = THUMBNAIL_SIDE,
): { x: number; y: number; width: number; height: number } => {
  const scale = Math.min(side / Math.max(1, pixelWidth), side / Math.max(1, pixelHeight));
  const width = Math.max(1, Math.round(pixelWidth * scale));
  const height = Math.max(1, Math.round(pixelHeight * scale));
  return { x: Math.floor((side - width) / 2), y: Math.floor((side - height) / 2), width, height };
};
