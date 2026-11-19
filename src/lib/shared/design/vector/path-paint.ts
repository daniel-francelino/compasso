import { clampPaint, clampStroke, safePathData, sortedStops } from "@/lib/shared/design/path";
import { hexToRgb } from "@/lib/shared/design/paint";
import type { PathElement, PathPaint, PathStroke } from "@/lib/shared/design/schemas";
import {
  DESIGN_LIMITS,
  DesignPathCap,
  DesignPathJoin,
  DesignPathPaintKind,
} from "@/lib/shared/design/types";

export type PathFrame = { x: number; y: number; width: number; height: number };

export type GradientFactory = Pick<
  CanvasRenderingContext2D,
  "createLinearGradient" | "createRadialGradient"
>;

const SQUARE_CAP_REACH = Math.SQRT2;

export const pathStrokePadding = (stroke: PathStroke | null): number => {
  if (stroke === null) return 0;
  const cap = stroke.cap === DesignPathCap.Square ? SQUARE_CAP_REACH : 1;
  const join = stroke.join === DesignPathJoin.Miter ? stroke.miterLimit : 1;
  return (stroke.width / 2) * Math.max(cap, join);
};

export const pathRasterFrame = (element: PathElement): PathFrame => {
  const room = (DESIGN_LIMITS.maxSize - Math.max(element.width, element.height)) / 2;
  const stroke = element.stroke === null ? null : clampStroke(element.stroke);
  const padding = Math.max(0, Math.min(pathStrokePadding(stroke), room));
  return {
    x: element.x - padding,
    y: element.y - padding,
    width: element.width + padding * 2,
    height: element.height + padding * 2,
  };
};

export const rgbaOf = (hex: string, alpha: number): string => {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

export const pathFillStyle = (
  context: GradientFactory,
  paint: PathPaint,
  box: { width: number; height: number },
): string | CanvasGradient => {
  if (paint.kind === DesignPathPaintKind.Solid) return paint.color;
  const gradient =
    paint.kind === DesignPathPaintKind.Linear
      ? context.createLinearGradient(
          paint.x1 * box.width,
          paint.y1 * box.height,
          paint.x2 * box.width,
          paint.y2 * box.height,
        )
      : context.createRadialGradient(
          paint.cx * box.width,
          paint.cy * box.height,
          0,
          paint.cx * box.width,
          paint.cy * box.height,
          paint.r * Math.min(box.width, box.height),
        );
  for (const stop of sortedStops(paint.stops))
    gradient.addColorStop(stop.offset, rgbaOf(stop.color, stop.alpha));
  return gradient;
};

const positiveView = (value: number): boolean => Number.isFinite(value) && value > 0;

export const safePathElement = (element: PathElement): PathElement | null => {
  const d = safePathData(element.d);
  if (d === null) return null;
  if (!positiveView(element.viewWidth) || !positiveView(element.viewHeight)) return null;
  const fill = element.fill === null ? null : clampPaint(element.fill);
  const stroke = element.stroke === null ? null : clampStroke(element.stroke);
  if (fill === null && element.fill !== null) return null;
  if (stroke === null && element.stroke !== null) return null;
  return { ...element, d, fill, stroke };
};
