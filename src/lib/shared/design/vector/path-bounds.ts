import type { Result } from "@/lib/shared/server-utils";
import {
  type Bounds,
  type PathCommand,
  PathFailure,
  pathFailure,
} from "@/lib/shared/design/vector/path-types";

type Point = { x: number; y: number };

const quadraticAt = (p0: number, p1: number, p2: number, t: number): number => {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
};

const cubicAt = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

const quadraticExtrema = (p0: number, p1: number, p2: number): number[] => {
  const denominator = p0 - 2 * p1 + p2;
  if (denominator === 0) return [];
  return [(p0 - p1) / denominator];
};

const cubicExtrema = (p0: number, p1: number, p2: number, p3: number): number[] => {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  if (a === 0) return b === 0 ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  const q = -0.5 * (b + (b < 0 ? -root : root));
  return q === 0 ? [0] : [q / a, c / q];
};

const inside = (t: number): boolean => Number.isFinite(t) && t > 0 && t < 1;

export const emptyBounds = (): Bounds => ({
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
});

const include = (bounds: Bounds, x: number, y: number): void => {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
};

const includeQuadratic = (bounds: Bounds, from: Point, c: PathCommand & { type: "Q" }): void => {
  const ts = [
    ...quadraticExtrema(from.x, c.x1, c.x),
    ...quadraticExtrema(from.y, c.y1, c.y),
  ].filter(inside);
  for (const t of ts) {
    include(bounds, quadraticAt(from.x, c.x1, c.x, t), quadraticAt(from.y, c.y1, c.y, t));
  }
  include(bounds, c.x, c.y);
};

const includeCubic = (bounds: Bounds, from: Point, c: PathCommand & { type: "C" }): void => {
  const ts = [
    ...cubicExtrema(from.x, c.x1, c.x2, c.x),
    ...cubicExtrema(from.y, c.y1, c.y2, c.y),
  ].filter(inside);
  for (const t of ts) {
    include(bounds, cubicAt(from.x, c.x1, c.x2, c.x, t), cubicAt(from.y, c.y1, c.y2, c.y, t));
  }
  include(bounds, c.x, c.y);
};

export const pathBounds = (commands: readonly PathCommand[]): Result<{ bounds: Bounds }> => {
  const bounds = emptyBounds();
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let started = false;
  for (const command of commands) {
    if (command.type === "M") {
      current = { x: command.x, y: command.y };
      start = current;
      started = false;
      continue;
    }
    if (command.type === "Z") {
      current = start;
      continue;
    }
    if (!started) include(bounds, current.x, current.y);
    started = true;
    if (command.type === "L") include(bounds, command.x, command.y);
    if (command.type === "Q") includeQuadratic(bounds, current, command);
    if (command.type === "C") includeCubic(bounds, current, command);
    current = { x: command.x, y: command.y };
  }
  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX)) {
    return pathFailure(PathFailure.Empty);
  }
  return { ok: true, bounds };
};
