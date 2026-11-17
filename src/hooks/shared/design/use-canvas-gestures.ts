import type Konva from "konva";
import { useRef, useState } from "react";
import { type DrawTool, isDrawTool } from "@/lib/shared/design/arrange";
import type { Box } from "@/lib/shared/design/document";
import { DESIGN_LIMITS, DesignTool } from "@/lib/shared/design/types";
import { type Point, boxFromPoints } from "@/lib/shared/design/viewport";

export type CanvasDraft =
  | { kind: "marquee"; start: Point; end: Point; additive: boolean }
  | { kind: "draw"; tool: DrawTool; start: Point; end: Point; shift: boolean };

export type GestureCallbacks = {
  onSelect?: (id: string | null, additive: boolean) => void;
  onMarquee?: (box: Box, additive: boolean) => void;
  onDraw?: (tool: DrawTool, start: Point, end: Point | null, shift: boolean) => void;
  onPan?: (dx: number, dy: number) => void;
  onZoom?: (factor: number, point: Point) => void;
  onZoomStep?: (direction: 1 | -1, point: Point) => void;
  onCursor?: (point: Point | null) => void;
};

type PointerEvent = Konva.KonvaEventObject<globalThis.PointerEvent>;
type Pan = { x: number; y: number };

const MIDDLE_BUTTON = 1;

const pointsOf = (event: PointerEvent | Konva.KonvaEventObject<WheelEvent>) => {
  const stage = event.target.getStage();
  const doc = stage?.getRelativePointerPosition() ?? null;
  const screen = stage?.getPointerPosition() ?? null;
  return { stage, doc, screen };
};

const isEmptyTarget = (event: PointerEvent) =>
  event.target === event.target.getStage() || event.target.name() === "page";

const movedEnough = (start: Point, end: Point, zoom: number) =>
  Math.hypot(end.x - start.x, end.y - start.y) * zoom >= DESIGN_LIMITS.drawMinScreenPx;

export const useCanvasGestures = (tool: DesignTool, zoom: number, callbacks: GestureCallbacks) => {
  const [draft, setDraftState] = useState<CanvasDraft | null>(null);
  const draftRef = useRef<CanvasDraft | null>(null);
  const pan = useRef<Pan | null>(null);

  const setDraft = (next: CanvasDraft | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const startPan = (event: PointerEvent) => {
    pan.current = { x: event.evt.clientX, y: event.evt.clientY };
  };

  const onPointerDown = (event: PointerEvent) => {
    const { stage, doc, screen } = pointsOf(event);
    if (stage === null || doc === null || screen === null) return;
    stage.content.setPointerCapture(event.evt.pointerId);
    if (event.evt.button === MIDDLE_BUTTON || tool === DesignTool.Hand) {
      startPan(event);
      return;
    }
    if (tool === DesignTool.Zoom) {
      callbacks.onZoomStep?.(event.evt.altKey ? -1 : 1, screen);
      return;
    }
    if (isDrawTool(tool)) {
      setDraft({ kind: "draw", tool, start: doc, end: doc, shift: event.evt.shiftKey });
      return;
    }
    if (!isEmptyTarget(event)) return;
    setDraft({ kind: "marquee", start: doc, end: doc, additive: event.evt.shiftKey });
  };

  const onPointerMove = (event: PointerEvent) => {
    const { doc } = pointsOf(event);
    callbacks.onCursor?.(doc);
    const panning = pan.current;
    if (panning !== null) {
      callbacks.onPan?.(event.evt.clientX - panning.x, event.evt.clientY - panning.y);
      pan.current = { x: event.evt.clientX, y: event.evt.clientY };
      return;
    }
    const current = draftRef.current;
    if (doc === null || current === null) return;
    setDraft(
      current.kind === "draw"
        ? { ...current, end: doc, shift: event.evt.shiftKey }
        : { ...current, end: doc },
    );
  };

  const finish = (current: CanvasDraft) => {
    const moved = movedEnough(current.start, current.end, zoom);
    if (current.kind === "draw") {
      callbacks.onDraw?.(current.tool, current.start, moved ? current.end : null, current.shift);
      return;
    }
    if (moved) {
      callbacks.onMarquee?.(boxFromPoints(current.start, current.end, false), current.additive);
      return;
    }
    if (!current.additive) callbacks.onSelect?.(null, false);
  };

  const onPointerUp = () => {
    pan.current = null;
    const current = draftRef.current;
    setDraft(null);
    if (current !== null) finish(current);
  };

  const onWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const { screen } = pointsOf(event);
    if (screen === null) return;
    if (event.evt.ctrlKey || event.evt.metaKey) {
      callbacks.onZoom?.(Math.exp(-event.evt.deltaY * DESIGN_LIMITS.wheelZoomSpeed), screen);
      return;
    }
    const horizontal = event.evt.shiftKey ? event.evt.deltaY : event.evt.deltaX;
    const vertical = event.evt.shiftKey ? 0 : event.evt.deltaY;
    callbacks.onPan?.(-horizontal, -vertical);
  };

  return {
    draft,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave: () => callbacks.onCursor?.(null),
      onWheel,
    },
  };
};
