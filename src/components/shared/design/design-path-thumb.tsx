import { PenTool } from "lucide-react";
import { useEffect, useRef } from "react";
import { THUMBNAIL_SIDE, thumbnailBox } from "@/lib/shared/design/layers";
import { isGradient, safePathData, sortedStops, stopColor } from "@/lib/shared/design/path";
import type { PathElement } from "@/lib/shared/design/schemas";

const hasPath2D = () => typeof Path2D !== "undefined";

const fillColor = (fill: PathElement["fill"]): string | null => {
  if (fill === null) return null;
  if (!isGradient(fill)) return fill.color;
  const first = sortedStops(fill.stops)[0];
  return first === undefined ? null : stopColor(first);
};

export function DesignPathThumb({ element }: { element: PathElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { d, fill, stroke, fillRule, viewWidth, viewHeight } = element;
  const safe = safePathData(d);
  const supported = hasPath2D() && safe !== null;

  useEffect(() => {
    const target = ref.current;
    const context = target?.getContext("2d") ?? null;
    if (target === null || context === null || safe === null) return;
    const box = thumbnailBox(viewWidth, viewHeight);
    const scale = box.width / Math.max(1, viewWidth);
    context.clearRect(0, 0, THUMBNAIL_SIDE, THUMBNAIL_SIDE);
    context.save();
    context.translate(box.x, box.y);
    context.scale(scale, box.height / Math.max(1, viewHeight));
    const shape = new Path2D(safe);
    const color = fillColor(fill);
    if (color !== null) {
      context.fillStyle = color;
      context.fill(shape, fillRule);
    }
    if (stroke !== null) {
      context.strokeStyle = stroke.color;
      context.lineWidth = Math.max(1 / Math.max(scale, 0.001), stroke.width);
      context.stroke(shape);
    }
    context.restore();
  }, [safe, fill, stroke, fillRule, viewWidth, viewHeight]);

  if (!supported) return <PenTool aria-hidden="true" className="size-4 text-foreground" />;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      width={THUMBNAIL_SIDE}
      height={THUMBNAIL_SIDE}
      className="size-8"
    />
  );
}
