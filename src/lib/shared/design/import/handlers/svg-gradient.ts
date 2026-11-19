import {
  type Budget,
  SvgFallback,
  type XmlElement,
  reject,
} from "@/lib/shared/design/import/handlers/svg-vector-types";
import {
  type StyleSheet,
  declarationsOf,
  stopStyleOf,
} from "@/lib/shared/design/import/handlers/svg-style";
import {
  readLengthOrPercent,
  readTransform,
  readUnit,
} from "@/lib/shared/design/import/handlers/svg-values";
import type { PathPaint } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignPathPaintKind } from "@/lib/shared/design/types";
import type { Bounds } from "@/lib/shared/design/vector/path-data";
import {
  type Matrix,
  IDENTITY,
  applyToPoint,
  composeAll,
  matrix,
} from "@/lib/shared/design/vector/matrix";

const LINEAR = "linearGradient";
const RADIAL = "radialGradient";
const MAX_CHAIN = 8;
const TOLERANCE = 1e-3;
const OBJECT_BOUNDING_BOX = "objectBoundingBox";
const USER_SPACE = "userSpaceOnUse";
const SPREAD_PAD = "pad";
const HALF = 0.5;
const SQUARE_TOLERANCE = 0.01;

export type GradientStop = { offset: number; color: string; alpha: number };

export type GradientDef = {
  radial: boolean;
  userSpace: boolean;
  transform: Matrix;
  attrs: ReadonlyMap<string, string>;
  stops: GradientStop[];
};

export type GradientContext = {
  budget: Budget;
  ids: ReadonlyMap<string, XmlElement>;
  sheet: StyleSheet;
  cache: Map<string, GradientDef>;
  viewportWidth: number;
  viewportHeight: number;
};

const isGradient = (element: XmlElement): boolean =>
  element.name === LINEAR || element.name === RADIAL;

const hrefOf = (element: XmlElement): string | undefined =>
  element.attrs.get("href") ?? element.attrs.get("xlink:href");

const chainOf = (ctx: GradientContext, id: string): XmlElement[] => {
  const chain: XmlElement[] = [];
  let next: string | undefined = id;
  while (next !== undefined) {
    const element = ctx.ids.get(next);
    if (element === undefined || !isGradient(element)) throw reject(SvgFallback.Unsupported);
    if (chain.includes(element)) throw reject(SvgFallback.Malformed);
    chain.push(element);
    if (chain.length > MAX_CHAIN) throw reject(SvgFallback.ParseLimit);
    next = hrefOf(element)?.slice(1);
  }
  return chain;
};

const readStops = (ctx: GradientContext, chain: readonly XmlElement[]): GradientStop[] => {
  const owner = chain.find((element) => element.children.some((child) => child.name === "stop"));
  const stops: GradientStop[] = [];
  let previous = 0;
  for (const child of owner?.children ?? []) {
    if (child.name !== "stop") continue;
    if (stops.length >= DESIGN_LIMITS.maxGradientStops) throw reject(SvgFallback.ParseLimit);
    const offset = Math.max(previous, readUnit(child.attrs.get("offset") ?? "0"));
    const style = stopStyleOf(declarationsOf(child, ctx.sheet, ctx.budget));
    previous = offset;
    stops.push({ offset, color: style.color, alpha: style.opacity });
  }
  return stops;
};

const mergedAttributes = (chain: readonly XmlElement[]): Map<string, string> => {
  const head = chain[0];
  const merged = new Map<string, string>();
  for (const element of [...chain].reverse()) {
    const sameKind = element.name === head?.name;
    for (const [name, value] of element.attrs) {
      const shared = name === "gradientUnits" || name === "gradientTransform";
      if (sameKind || shared || name === "spreadMethod") merged.set(name, value);
    }
  }
  return merged;
};

export const resolveGradient = (ctx: GradientContext, id: string): GradientDef => {
  const cached = ctx.cache.get(id);
  if (cached !== undefined) return cached;
  const chain = chainOf(ctx, id);
  const attrs = mergedAttributes(chain);
  const units = attrs.get("gradientUnits") ?? OBJECT_BOUNDING_BOX;
  const spread = attrs.get("spreadMethod") ?? SPREAD_PAD;
  const known = units === OBJECT_BOUNDING_BOX || units === USER_SPACE;
  if (!known || spread !== SPREAD_PAD) throw reject(SvgFallback.Unsupported);
  const transform = attrs.get("gradientTransform");
  const def: GradientDef = {
    radial: chain[0]?.name === RADIAL,
    userSpace: units === USER_SPACE,
    transform: transform === undefined ? IDENTITY : readTransform(transform),
    attrs,
    stops: readStops(ctx, chain),
  };
  ctx.cache.set(id, def);
  return def;
};

export type PaintTarget = { ctm: Matrix; localBounds: Bounds; pageBounds: Bounds };

type Axis = "x" | "y" | "r";

const readCoordinate = (
  ctx: GradientContext,
  def: GradientDef,
  name: string,
  axis: Axis,
  fallback: number,
): number => {
  const text = def.attrs.get(name);
  const dimension = {
    x: ctx.viewportWidth,
    y: ctx.viewportHeight,
    r: Math.sqrt((ctx.viewportWidth ** 2 + ctx.viewportHeight ** 2) / 2),
  }[axis];
  if (text === undefined) return def.userSpace ? fallback * dimension : fallback;
  const length = readLengthOrPercent(text);
  if (!length.percent) return length.value;
  return def.userSpace ? (length.value / 100) * dimension : length.value / 100;
};

const clampFraction = (value: number): number => {
  if (!Number.isFinite(value) || value < -TOLERANCE || value > 1 + TOLERANCE) {
    throw reject(SvgFallback.Unsupported);
  }
  return Math.min(1, Math.max(0, value));
};

const effectiveMatrix = (def: GradientDef, target: PaintTarget): Matrix => {
  const { minX, minY, maxX, maxY } = target.localBounds;
  const width = maxX - minX;
  const height = maxY - minY;
  if (!def.userSpace && (width <= 0 || height <= 0)) throw reject(SvgFallback.Unsupported);
  const box = def.userSpace ? IDENTITY : matrix(width, 0, 0, height, minX, minY);
  return composeAll([target.ctm, box, def.transform]);
};

const pageFraction = (target: PaintTarget, point: { x: number; y: number }) => {
  const { minX, minY, maxX, maxY } = target.pageBounds;
  if (maxX - minX <= 0 || maxY - minY <= 0) throw reject(SvgFallback.Unsupported);
  return {
    x: clampFraction((point.x - minX) / (maxX - minX)),
    y: clampFraction((point.y - minY) / (maxY - minY)),
  };
};

const linearPaint = (ctx: GradientContext, def: GradientDef, target: PaintTarget): PathPaint => {
  const m = effectiveMatrix(def, target);
  const start = applyToPoint(m, {
    x: readCoordinate(ctx, def, "x1", "x", 0),
    y: readCoordinate(ctx, def, "y1", "y", 0),
  });
  const end = applyToPoint(m, {
    x: readCoordinate(ctx, def, "x2", "x", 1),
    y: readCoordinate(ctx, def, "y2", "y", 0),
  });
  const first = pageFraction(target, start);
  const second = pageFraction(target, end);
  return {
    kind: DesignPathPaintKind.Linear,
    x1: first.x,
    y1: first.y,
    x2: second.x,
    y2: second.y,
    stops: def.stops,
  };
};

const isSimilarity = (m: Matrix): boolean => {
  const [a, b, c, d] = m;
  const left = a * a + b * b;
  const right = c * c + d * d;
  const tolerance = TOLERANCE * Math.max(left, right);
  return Math.abs(left - right) <= tolerance && Math.abs(a * c + b * d) <= tolerance;
};

const radialPaint = (ctx: GradientContext, def: GradientDef, target: PaintTarget): PathPaint => {
  const m = effectiveMatrix(def, target);
  if (!isSimilarity(m)) throw reject(SvgFallback.Unsupported);
  const cx = readCoordinate(ctx, def, "cx", "x", HALF);
  const cy = readCoordinate(ctx, def, "cy", "y", HALF);
  const focalX = readCoordinate(ctx, def, "fx", "x", def.userSpace ? cx / ctx.viewportWidth : cx);
  const focalY = readCoordinate(ctx, def, "fy", "y", def.userSpace ? cy / ctx.viewportHeight : cy);
  const moved = Math.abs(focalX - cx) + Math.abs(focalY - cy);
  if (moved > TOLERANCE) throw reject(SvgFallback.Unsupported);
  const radius = readCoordinate(ctx, def, "r", "r", HALF);
  const center = pageFraction(target, applyToPoint(m, { x: cx, y: cy }));
  const { minX, minY, maxX, maxY } = target.pageBounds;
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  if (Math.abs(boxWidth - boxHeight) > SQUARE_TOLERANCE * Math.max(boxWidth, boxHeight)) {
    throw reject(SvgFallback.Unsupported);
  }
  const reach = (radius * Math.sqrt(m[0] * m[0] + m[1] * m[1])) / Math.min(boxWidth, boxHeight);
  if (!(reach > 0)) throw reject(SvgFallback.Unsupported);
  return {
    kind: DesignPathPaintKind.Radial,
    cx: center.x,
    cy: center.y,
    r: clampFraction(reach),
    stops: def.stops,
  };
};

export const gradientPaint = (ctx: GradientContext, id: string, target: PaintTarget): PathPaint => {
  const def = resolveGradient(ctx, id);
  if (def.stops.length < DESIGN_LIMITS.minGradientStops) throw reject(SvgFallback.Unsupported);
  return def.radial ? radialPaint(ctx, def, target) : linearPaint(ctx, def, target);
};

export const singleStopColor = (ctx: GradientContext, id: string): string | null => {
  const def = resolveGradient(ctx, id);
  const [only] = def.stops;
  if (def.stops.length !== 1 || only === undefined) return null;
  if (only.alpha !== 1) throw reject(SvgFallback.Unsupported);
  return only.color;
};
