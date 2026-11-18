import { smoothingRadius, PAINT_LIMITS, type BrushOptions } from "@/lib/shared/design/paint";
import {
  beginStroke,
  finishStroke,
  paintStroke,
  stabilize,
  type BrushParams,
} from "@/lib/shared/design/raster/brush";
import type { PixelPatch } from "@/lib/shared/design/raster/pixel-history";
import type { PixelBuffer, Point } from "@/lib/shared/design/raster/pixel-buffer";

export type StrokeSession = {
  move: (points: readonly Point[]) => void;
  finish: () => PixelPatch | null;
};

export const createStrokeSession = (
  buffer: PixelBuffer,
  params: BrushParams,
  options: BrushOptions,
): StrokeSession => {
  const stroke = beginStroke(buffer);
  const radius = smoothingRadius(options);
  let last: Point | null = null;
  let carry: number | undefined;

  const next = (target: Point): Point =>
    last === null || radius <= 0 ? target : stabilize(last, target, radius);

  const move = (points: readonly Point[]) => {
    for (const target of points) {
      const point = next(target);
      const path = last === null ? [point] : [last, point];
      carry = paintStroke(stroke, path, params, PAINT_LIMITS.spacingPercent, carry);
      last = point;
    }
  };

  const finish = (): PixelPatch | null => {
    const patch = finishStroke(stroke);
    return patch.tiles.length === 0 ? null : patch;
  };

  return { move, finish };
};
