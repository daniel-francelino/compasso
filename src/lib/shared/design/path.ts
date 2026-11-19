import { mapElements, normalizeColor, rgbToHex } from "@/lib/shared/design/document";
import type { DesignPage, PathElement, PathPaint, PathStroke } from "@/lib/shared/design/schemas";
import { readNormalizedPath, serializePath } from "@/lib/shared/design/vector/path-data";
import {
  DESIGN_LIMITS,
  DesignBlendMode,
  DesignElementKind,
  DesignPathCap,
  DesignPathFillRule,
  DesignPathJoin,
  DesignPathPaintKind,
  type PageSize,
} from "@/lib/shared/design/types";

export type PathShape = {
  id: string;
  d: string;
  width: number;
  height: number;
  fill?: PathPaint | null;
  stroke?: PathStroke | null;
  fillRule?: DesignPathFillRule;
  name?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const side = (value: number) => clamp(value, DESIGN_LIMITS.minSize, DESIGN_LIMITS.maxSize);

export const solidPaint = (color: string): PathPaint => ({
  kind: DesignPathPaintKind.Solid,
  color,
});

export const defaultPathStroke = (color: string): PathStroke => ({
  color,
  width: 1,
  cap: DesignPathCap.Butt,
  join: DesignPathJoin.Miter,
  miterLimit: 4,
  dashed: false,
});

export const createPath = (shape: PathShape, page: PageSize): PathElement => {
  const width = side(shape.width);
  const height = side(shape.height);
  return {
    id: shape.id,
    kind: DesignElementKind.Path,
    x: Math.round((page.width - width) / 2),
    y: Math.round((page.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    groupId: null,
    blendMode: DesignBlendMode.Normal,
    fillOpacity: 1,
    name: shape.name ?? "",
    hidden: false,
    parentId: null,
    clipToBelow: false,
    mask: null,
    d: shape.d,
    viewWidth: width,
    viewHeight: height,
    fill: shape.fill ?? null,
    stroke: shape.stroke ?? null,
    fillRule: shape.fillRule ?? DesignPathFillRule.NonZero,
  };
};

export type GradientPaint = Extract<PathPaint, { kind: "linear" } | { kind: "radial" }>;

export const isGradient = (paint: PathPaint | null): paint is GradientPaint =>
  paint !== null && paint.kind !== DesignPathPaintKind.Solid;

export type PathStop = { offset: number; color: string; alpha: number };
export type PathPatch = {
  fill?: PathPaint | null;
  stroke?: PathStroke | null;
  fillRule?: DesignPathFillRule;
};

const unit = (value: number) => (Number.isFinite(value) ? clamp(value, 0, 1) : 0);

export const sortedStops = (stops: readonly PathStop[]): PathStop[] =>
  [...stops].sort((a, b) => a.offset - b.offset);

export const stopColor = (stop: PathStop): string => {
  const hex = normalizeColor(stop.color) ?? rgbToHex(0, 0, 0);
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const alpha = Math.round(unit(stop.alpha) * 1000) / 1000;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

export const gradientCss = (stops: readonly PathStop[]): string =>
  `linear-gradient(to right, ${sortedStops(stops)
    .map((stop) => `${stopColor(stop)} ${Math.round(unit(stop.offset) * 100)}%`)
    .join(", ")})`;

export type PathGradientProps =
  | { kind: "color"; color: string }
  | { kind: "linear"; start: [number, number]; end: [number, number]; stops: (number | string)[] }
  | {
      kind: "radial";
      center: [number, number];
      radius: number;
      stops: (number | string)[];
    };

const konvaStops = (stops: readonly PathStop[]): (number | string)[] =>
  sortedStops(stops).flatMap((stop) => [unit(stop.offset), stopColor(stop)]);

export const pathPaintProps = (element: PathElement): PathGradientProps | null => {
  const paint = element.fill;
  if (paint === null) return null;
  if (paint.kind === DesignPathPaintKind.Solid) return { kind: "color", color: paint.color };
  if (paint.kind === DesignPathPaintKind.Linear) {
    return {
      kind: "linear",
      start: [paint.x1 * element.viewWidth, paint.y1 * element.viewHeight],
      end: [paint.x2 * element.viewWidth, paint.y2 * element.viewHeight],
      stops: konvaStops(paint.stops),
    };
  }
  return {
    kind: "radial",
    center: [paint.cx * element.viewWidth, paint.cy * element.viewHeight],
    radius: paint.r * Math.min(element.viewWidth, element.viewHeight),
    stops: konvaStops(paint.stops),
  };
};

export const pathDash = (stroke: PathStroke): number[] =>
  stroke.dashed ? [stroke.width * 3, stroke.width * 2] : [];

const SAFE_LIMITS = {
  maxData: DESIGN_LIMITS.maxPathData,
  maxCommands: DESIGN_LIMITS.maxPathCommands,
  maxCoordinate: DESIGN_LIMITS.maxCoordinate,
};
const SAFE_CACHE_MAX = 256;
const safeCache = new Map<string, string | null>();

export const safePathData = (d: string): string | null => {
  const cached = safeCache.get(d);
  if (cached !== undefined) return cached;
  const read = readNormalizedPath(d, SAFE_LIMITS);
  const written = read.ok ? serializePath(read.commands, SAFE_LIMITS) : null;
  const safe = written !== null && written.ok ? written.d : null;
  if (safeCache.size >= SAFE_CACHE_MAX) safeCache.clear();
  safeCache.set(d, safe);
  return safe;
};

const cleanStops = (stops: readonly PathStop[]): PathStop[] | null => {
  const kept = stops.slice(0, DESIGN_LIMITS.maxGradientStops).map((stop) => ({
    offset: unit(stop.offset),
    color: normalizeColor(stop.color) ?? rgbToHex(0, 0, 0),
    alpha: unit(stop.alpha),
  }));
  return kept.length < DESIGN_LIMITS.minGradientStops ? null : kept;
};

export const clampPaint = (paint: PathPaint): PathPaint | null => {
  if (paint.kind === DesignPathPaintKind.Solid) {
    const color = normalizeColor(paint.color);
    return color === null ? null : { kind: paint.kind, color };
  }
  const stops = cleanStops(paint.stops);
  if (stops === null) return null;
  if (paint.kind === DesignPathPaintKind.Linear) {
    return {
      kind: paint.kind,
      x1: unit(paint.x1),
      y1: unit(paint.y1),
      x2: unit(paint.x2),
      y2: unit(paint.y2),
      stops,
    };
  }
  const radius = Number.isFinite(paint.r) && paint.r > 0 ? Math.min(1, paint.r) : 0.5;
  return { kind: paint.kind, cx: unit(paint.cx), cy: unit(paint.cy), r: radius, stops };
};

export const clampStroke = (stroke: PathStroke): PathStroke | null => {
  const color = normalizeColor(stroke.color);
  if (color === null) return null;
  const width = Number.isFinite(stroke.width) ? stroke.width : 1;
  const miter = Number.isFinite(stroke.miterLimit) ? stroke.miterLimit : 4;
  return {
    ...stroke,
    color,
    width: clamp(width, DESIGN_LIMITS.minPathStrokeWidth, DESIGN_LIMITS.maxPathStrokeWidth),
    miterLimit: clamp(miter, DESIGN_LIMITS.minMiterLimit, DESIGN_LIMITS.maxMiterLimit),
  };
};

export const patchPath = (page: DesignPage, id: string, patch: PathPatch): DesignPage =>
  mapElements(page, [id], (element) => {
    if (element.kind !== DesignElementKind.Path) return element;
    const fill =
      patch.fill === undefined ? element.fill : patch.fill === null ? null : clampPaint(patch.fill);
    const stroke =
      patch.stroke === undefined
        ? element.stroke
        : patch.stroke === null
          ? null
          : clampStroke(patch.stroke);
    return {
      ...element,
      fill: fill ?? (patch.fill === null ? null : element.fill),
      stroke: stroke ?? (patch.stroke === null ? null : element.stroke),
      fillRule: patch.fillRule ?? element.fillRule,
    };
  });
