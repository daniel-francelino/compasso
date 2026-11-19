import type { PathElement } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

export const scalePathStroke = (element: PathElement, scale: number): PathElement => {
  if (element.stroke === null || !Number.isFinite(scale) || scale <= 0) return element;
  const width = Math.min(
    DESIGN_LIMITS.maxPathStrokeWidth,
    Math.max(DESIGN_LIMITS.minPathStrokeWidth, element.stroke.width * scale),
  );
  return { ...element, stroke: { ...element.stroke, width: Math.round(width * 100) / 100 } };
};
