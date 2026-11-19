import { SVG_PATH_LIMITS } from "@/lib/shared/design/import/handlers/svg-shapes";
import {
  type SvgFailure,
  type SvgVectorDocument,
  type SvgVectorShape,
  SvgFallback,
  svgFailure,
} from "@/lib/shared/design/import/handlers/svg-vector-types";
import { databaseDocumentBytes } from "@/lib/shared/design/document-size";
import { emptyDocument, emptyPage, fitInside } from "@/lib/shared/design/document";
import { createPath } from "@/lib/shared/design/path";
import {
  type DesignElement,
  type PathElement,
  type PathStroke,
  pathElementSchema,
} from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, type PageSize } from "@/lib/shared/design/types";
import {
  type Bounds,
  parsePathData,
  pathBounds,
  serializePath,
  toBoxLocal,
} from "@/lib/shared/design/vector/path-data";

const DECIMALS = 1000;
const FALLBACK_PAGE_ID = "import";

const round3 = (value: number): number => Math.round(value * DECIMALS) / DECIMALS;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const isSolidOrNone = (shape: SvgVectorShape): boolean =>
  shape.fill === null || shape.fill.kind === "solid";

const disjoint = (a: Bounds, b: Bounds): boolean =>
  a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY;

const samePaint = (a: SvgVectorShape, b: SvgVectorShape): boolean =>
  isSolidOrNone(a) &&
  isSolidOrNone(b) &&
  sameJson(a.fill, b.fill) &&
  sameJson(a.stroke, b.stroke) &&
  a.fillRule === b.fillRule &&
  a.opacity === b.opacity;

const fitsTogether = (a: SvgVectorShape, b: SvgVectorShape): boolean =>
  a.commandCount + b.commandCount <= DESIGN_LIMITS.maxPathCommands &&
  a.d.length + b.d.length <= DESIGN_LIMITS.maxPathData;

export const canMerge = (a: SvgVectorShape, b: SvgVectorShape): boolean =>
  samePaint(a, b) && fitsTogether(a, b) && disjoint(a.bounds, b.bounds);

const union = (a: Bounds, b: Bounds): Bounds => ({
  minX: Math.min(a.minX, b.minX),
  minY: Math.min(a.minY, b.minY),
  maxX: Math.max(a.maxX, b.maxX),
  maxY: Math.max(a.maxY, b.maxY),
});

const joined = (a: SvgVectorShape, b: SvgVectorShape): SvgVectorShape => ({
  ...a,
  d: a.d + b.d,
  commandCount: a.commandCount + b.commandCount,
  bounds: union(a.bounds, b.bounds),
});

export const mergeShapes = (shapes: readonly SvgVectorShape[]): SvgVectorShape[] => {
  const merged: SvgVectorShape[] = [];
  for (const shape of shapes) {
    const last = merged[merged.length - 1];
    if (last !== undefined && canMerge(last, shape))
      merged[merged.length - 1] = joined(last, shape);
    else merged.push(shape);
  }
  return merged;
};

const scaledStroke = (stroke: PathStroke | null, scale: number): PathStroke | null =>
  stroke === null
    ? null
    : {
        ...stroke,
        width: round3(
          clamp(
            stroke.width * scale,
            DESIGN_LIMITS.minPathStrokeWidth,
            DESIGN_LIMITS.maxPathStrokeWidth,
          ),
        ),
      };

type Layout = { scale: number; offsetX: number; offsetY: number; page: PageSize };

const layoutOf = (document: SvgVectorDocument, page: PageSize): Layout => {
  const fitted = fitInside({ width: document.width, height: document.height }, page);
  const scale = Math.min(1, fitted.width / document.width, fitted.height / document.height);
  return {
    scale,
    offsetX: (page.width - document.width * scale) / 2,
    offsetY: (page.height - document.height * scale) / 2,
    page,
  };
};

const elementOf = (shape: SvgVectorShape, layout: Layout, id: string): PathElement | SvgFailure => {
  const parsed = parsePathData(shape.d, SVG_PATH_LIMITS);
  if (!parsed.ok) return svgFailure(SvgFallback.VectorLimit);
  const measured = pathBounds(parsed.commands);
  const local = toBoxLocal(
    parsed.commands,
    { scale: layout.scale, maxSize: DESIGN_LIMITS.maxSize },
    SVG_PATH_LIMITS,
  );
  if (!measured.ok || !local.ok) return svgFailure(SvgFallback.VectorLimit);
  const written = serializePath(local.commands, SVG_PATH_LIMITS);
  if (!written.ok) return svgFailure(SvgFallback.VectorLimit);
  const path = createPath(
    {
      id,
      d: written.d,
      width: Math.round(clamp(local.width, DESIGN_LIMITS.minSize, DESIGN_LIMITS.maxSize)),
      height: Math.round(clamp(local.height, DESIGN_LIMITS.minSize, DESIGN_LIMITS.maxSize)),
      fill: shape.fill,
      stroke: scaledStroke(shape.stroke, layout.scale),
      fillRule: shape.fillRule,
      ...(shape.name === null ? {} : { name: shape.name }),
    },
    layout.page,
  );
  const parsedElement = pathElementSchema.safeParse({
    ...path,
    x: Math.round(layout.offsetX + measured.bounds.minX * layout.scale),
    y: Math.round(layout.offsetY + measured.bounds.minY * layout.scale),
    opacity: shape.opacity,
  });
  return parsedElement.success ? parsedElement.data : svgFailure(SvgFallback.VectorLimit);
};

export const documentGrowth = (elements: readonly DesignElement[]): number => {
  const base = emptyDocument(FALLBACK_PAGE_ID);
  const candidate = {
    ...base,
    pages: [{ ...emptyPage(FALLBACK_PAGE_ID), elements: [...elements] }],
  };
  return databaseDocumentBytes(candidate) - databaseDocumentBytes(base) + 1;
};

export type VectorBuildLimits = {
  page: PageSize;
  capacityElements: number;
  documentBytes: number;
  newId: () => string;
};

const totalData = (elements: readonly PathElement[]): number =>
  elements.reduce((total, element) => total + element.d.length, 0);

export const buildPathElements = (
  document: SvgVectorDocument,
  limits: VectorBuildLimits,
): { ok: true; elements: PathElement[] } | SvgFailure => {
  const merged = mergeShapes(document.shapes);
  if (merged.length > limits.capacityElements) return svgFailure(SvgFallback.VectorLimit);
  const layout = layoutOf(document, limits.page);
  const elements: PathElement[] = [];
  for (const shape of merged) {
    const built = elementOf(shape, layout, limits.newId());
    if ("ok" in built) return built;
    elements.push(built);
  }
  if (totalData(elements) > DESIGN_LIMITS.maxVectorImportBytes) {
    return svgFailure(SvgFallback.VectorLimit);
  }
  if (limits.documentBytes + documentGrowth(elements) > DESIGN_LIMITS.maxBytes) {
    return svgFailure(SvgFallback.VectorLimit);
  }
  return { ok: true, elements };
};
