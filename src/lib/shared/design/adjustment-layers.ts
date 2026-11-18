import { isRasterStackKind } from "@/lib/shared/design/document";
import {
  ADJUSTMENT_TYPE_LABEL,
  type AdjustmentType,
  MAX_CURVE_POINTS,
  MIN_CURVE_POINTS,
} from "@/lib/shared/design/raster/adjustment-types";
import {
  type AdjustmentParams,
  type CurvePoint,
  adjustmentSchema,
} from "@/lib/shared/design/raster/adjustment-schemas";
import { clamp } from "@/lib/shared/design/raster/numeric";
import { defaultAdjustment } from "@/lib/shared/design/raster/adjustments";
import type { AdjustmentElement, DesignElement, DesignPage } from "@/lib/shared/design/schemas";
import { DesignBlendMode, DesignElementKind, type PageSize } from "@/lib/shared/design/types";

export const ADJUSTMENT_HINT =
  "O ajuste atua nas camadas de pixels logo abaixo dele, sem passar por texto, formas ou imagens. Use Camada > Rasterizar imagem para ajustar uma foto.";

export const CLIP_DISABLED_REASON =
  "Disponível para camadas de pixels e ajustes logo acima de outra camada de pixels ou ajuste.";

export const createAdjustmentLayer = (
  id: string,
  type: AdjustmentType,
  size: PageSize,
): AdjustmentElement => ({
  id,
  kind: DesignElementKind.Adjustment,
  x: 0,
  y: 0,
  width: size.width,
  height: size.height,
  rotation: 0,
  opacity: 1,
  locked: false,
  groupId: null,
  blendMode: DesignBlendMode.Normal,
  fillOpacity: 1,
  name: ADJUSTMENT_TYPE_LABEL[type],
  hidden: false,
  parentId: null,
  clipToBelow: false,
  mask: null,
  adjustment: defaultAdjustment(type),
});

export const insertIndexFor = (page: DesignPage, anchorId: string | null): number => {
  const anchor = page.elements.findIndex((element) => element.id === anchorId);
  const anchored = page.elements[anchor];
  if (anchored !== undefined && isRasterStackKind(anchored)) return anchor + 1;
  const top = page.elements.map(isRasterStackKind).lastIndexOf(true);
  return top >= 0 ? top + 1 : page.elements.length;
};

export const insertAdjustment = (
  page: DesignPage,
  element: AdjustmentElement,
  anchorId: string | null,
): DesignPage => {
  const index = insertIndexFor(page, anchorId);
  const anchor = page.elements[index - 1];
  const placed = { ...element, parentId: anchor?.parentId ?? null };
  const elements = [...page.elements];
  elements.splice(index, 0, placed);
  return { ...page, elements };
};

export const patchAdjustment = (
  page: DesignPage,
  id: string,
  params: AdjustmentParams,
): DesignPage => {
  const parsed = adjustmentSchema.safeParse(params);
  if (!parsed.success) return page;
  return {
    ...page,
    elements: page.elements.map((element) =>
      element.id === id && element.kind === DesignElementKind.Adjustment
        ? { ...element, adjustment: parsed.data }
        : element,
    ),
  };
};

export const canClipToBelow = (page: DesignPage, id: string): boolean => {
  const index = page.elements.findIndex((element) => element.id === id);
  const element: DesignElement | undefined = page.elements[index];
  const below = page.elements[index - 1];
  if (element === undefined || !isRasterStackKind(element)) return false;
  if (element.clipToBelow) return true;
  return below !== undefined && isRasterStackKind(below);
};

export const toggleClipToBelow = (page: DesignPage, id: string): DesignPage => {
  if (!canClipToBelow(page, id)) return page;
  return {
    ...page,
    elements: page.elements.map((element) =>
      element.id === id ? { ...element, clipToBelow: !element.clipToBelow } : element,
    ),
  };
};

export type CurveAxis = "x" | "y";

export const setCurvePoint = (
  points: readonly CurvePoint[],
  index: number,
  axis: CurveAxis,
  value: number,
): CurvePoint[] =>
  points.map((point, i) => {
    if (i !== index) return point;
    if (axis === "y") return { ...point, y: clamp(Math.round(value), 0, 255) };
    const min = (points[i - 1]?.x ?? -1) + 1;
    const max = (points[i + 1]?.x ?? 256) - 1;
    return { ...point, x: clamp(Math.round(value), min, max) };
  });

export const addCurvePoint = (points: readonly CurvePoint[]): CurvePoint[] => {
  if (points.length >= MAX_CURVE_POINTS) return [...points];
  let gap = 0;
  let at = 0;
  for (let i = 1; i < points.length; i += 1) {
    const width = (points[i]?.x ?? 0) - (points[i - 1]?.x ?? 0);
    if (width > gap) {
      gap = width;
      at = i;
    }
  }
  if (gap < 2) return [...points];
  const left = points[at - 1];
  const right = points[at];
  if (left === undefined || right === undefined) return [...points];
  const x = Math.round((left.x + right.x) / 2);
  const y = Math.round((left.y + right.y) / 2);
  return [...points.slice(0, at), { x, y }, ...points.slice(at)];
};

export const removeCurvePoint = (points: readonly CurvePoint[], index: number): CurvePoint[] =>
  points.length <= MIN_CURVE_POINTS ? [...points] : points.filter((_, i) => i !== index);
