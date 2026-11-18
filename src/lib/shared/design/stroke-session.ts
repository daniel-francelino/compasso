import {
  type PressureOptions,
  smoothingRadius,
  PAINT_LIMITS,
  type BrushOptions,
  withPressure,
} from "@/lib/shared/design/paint";
import {
  beginStroke,
  finishStroke,
  paintStroke,
  stabilize,
  type BrushParams,
  type DabStamp,
} from "@/lib/shared/design/raster/brush";
import type { PixelPatch } from "@/lib/shared/design/raster/pixel-history";
import type { PixelBuffer, Point } from "@/lib/shared/design/raster/pixel-buffer";

export type StrokePoint = Point & { pressure?: number };

export type StrokeSession = {
  seed: (from: Point) => void;
  move: (points: readonly StrokePoint[]) => void;
  last: () => Point | null;
  finish: () => PixelPatch | null;
};

export type StrokeExtras = { pressure?: PressureOptions; stamp?: DabStamp };

export const createStrokeSession = (
  buffer: PixelBuffer,
  params: BrushParams,
  options: BrushOptions,
  extras: StrokeExtras = {},
): StrokeSession => {
  const stroke = beginStroke(buffer);
  const radius = smoothingRadius(options);
  let last: Point | null = null;
  let carry: number | undefined;

  const next = (target: Point): Point =>
    last === null || radius <= 0 ? target : stabilize(last, target, radius);

  const seed = (from: Point) => {
    last = { x: from.x, y: from.y };
    carry = 0;
  };

  const move = (points: readonly StrokePoint[]) => {
    for (const target of points) {
      const point = next(target);
      const path = last === null ? [point] : [last, point];
      const applied =
        extras.pressure === undefined
          ? params
          : withPressure(params, target.pressure ?? 1, extras.pressure);
      carry = paintStroke(stroke, path, applied, PAINT_LIMITS.spacingPercent, carry, extras.stamp);
      last = point;
    }
  };

  const finish = (): PixelPatch | null => {
    const patch = finishStroke(stroke);
    return patch.tiles.length === 0 ? null : patch;
  };

  return { seed, move, last: () => last, finish };
};
