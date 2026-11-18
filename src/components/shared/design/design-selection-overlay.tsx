import type Konva from "konva";
import { useEffect, useMemo, useRef } from "react";
import { Group, Line, Shape } from "react-konva";
import type { CanvasChrome } from "@/lib/shared/design/browser";
import {
  type Outline,
  type SelectionMask,
  maskOutline,
} from "@/lib/shared/design/raster/selection";
import { MarqueeShape, type SelectionShape } from "@/lib/shared/design/selection-state";

const DASH_SCREEN_PX = 5;
const FRAME_MS = 120;
const ELLIPSE_STEPS = 72;
const NO_OUTLINE: Outline = { segments: [], truncated: false };

export const useSelectionOutline = (mask: SelectionMask | null, revision: number): Outline =>
  useMemo(() => (mask === null ? NO_OUTLINE : maskOutline(mask)), [mask, revision]);

const draftPoints = (shape: SelectionShape): { points: number[]; closed: boolean } => {
  if (shape.kind === "polygon") {
    return { points: shape.points.flatMap((point) => [point.x, point.y]), closed: false };
  }
  const { x, y, width, height } = shape.rect;
  if (shape.kind === MarqueeShape.Rect) {
    return { points: [x, y, x + width, y, x + width, y + height, x, y + height], closed: true };
  }
  const points = Array.from({ length: ELLIPSE_STEPS }, (_, i) => {
    const angle = (i / ELLIPSE_STEPS) * Math.PI * 2;
    return [
      x + width / 2 + (Math.cos(angle) * width) / 2,
      y + height / 2 + (Math.sin(angle) * height) / 2,
    ];
  }).flat();
  return { points, closed: true };
};

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function DesignSelectionOverlay({
  outline,
  draft,
  chrome,
  scale,
}: {
  outline: Outline;
  draft: SelectionShape | null;
  chrome: CanvasChrome;
  scale: number;
}) {
  const ants = useRef<Konva.Shape>(null);
  const dash = DASH_SCREEN_PX / Math.max(scale, 0.01);
  const width = 1 / Math.max(scale, 0.01);
  const hasOutline = outline.segments.length > 0;

  useEffect(() => {
    if (!hasOutline || prefersReducedMotion()) return;
    let frame = 0;
    let last = 0;
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      const node = ants.current;
      if (node === null || time - last < FRAME_MS) return;
      last = time;
      node.dashOffset((time / FRAME_MS) % (dash * 2));
      node.getLayer()?.batchDraw();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hasOutline, dash, outline]);

  const trace = (ctx: Konva.Context, shape: Konva.Shape) => {
    ctx.beginPath();
    for (const segment of outline.segments) {
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
    }
    ctx.strokeShape(shape);
  };

  const preview = draft === null ? null : draftPoints(draft);

  return (
    <Group listening={false}>
      {hasOutline ? (
        <>
          <Shape sceneFunc={trace} stroke={chrome.surface} strokeWidth={width} />
          <Shape
            ref={ants}
            sceneFunc={trace}
            stroke={chrome.ink}
            strokeWidth={width}
            dash={[dash, dash]}
          />
        </>
      ) : null}
      {preview === null ? null : (
        <>
          <Line
            points={preview.points}
            closed={preview.closed}
            stroke={chrome.surface}
            strokeWidth={width}
          />
          <Line
            points={preview.points}
            closed={preview.closed}
            stroke={chrome.ink}
            strokeWidth={width}
            dash={[dash, dash]}
          />
        </>
      )}
    </Group>
  );
}
