import { useEffect, useRef } from "react";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import type { BrushController } from "@/hooks/shared/design/use-brush-options";
import type { DesignColors } from "@/hooks/shared/design/use-design-colors";
import { type FillController, useDesignFill } from "@/hooks/shared/design/use-design-fill";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { PixelHistorySession } from "@/hooks/shared/design/use-pixel-history";
import type { MaskController } from "@/hooks/shared/design/use-design-mask";
import { resolveInheritance, rgbToHex } from "@/lib/shared/design/document";
import {
  MASK_PAINT_LABEL,
  type MaskPlacement,
  type PaintTarget,
  grayColor,
  grayOf,
} from "@/lib/shared/design/layer-mask";
import {
  PAINT_REASON,
  PAINT_UPLOAD_REASON,
  PaintSampleMode,
  cursorDiameterPx,
  docToLayerPoint,
  hexToRgb,
  isBrushTool,
  isFillTool,
  layerScale,
  toBrushParams,
} from "@/lib/shared/design/paint";
import type { SelectionController } from "@/hooks/shared/design/use-design-selection";
import { selectAllMask } from "@/lib/shared/design/selection-state";
import {
  type BrushParams,
  beginStroke,
  finishStroke,
  stampDab,
} from "@/lib/shared/design/raster/brush";
import { SampleSize, sampleColor } from "@/lib/shared/design/raster/fill";
import type { Point, RgbaColor } from "@/lib/shared/design/raster/pixel-buffer";
import { sampleCompositeAt } from "@/lib/shared/design/raster-canvas";
import { type StrokeSession, createStrokeSession } from "@/lib/shared/design/stroke-session";
import {
  DESIGN_TOOL_LABEL,
  DesignElementKind,
  DesignTool,
  type PageSize,
} from "@/lib/shared/design/types";

const paintReason = (canPaint: boolean, layerReady: boolean): string | undefined => {
  if (!canPaint) return PAINT_UPLOAD_REASON;
  return layerReady ? undefined : PAINT_REASON;
};

const CLEAR_SELECTION_LABEL = "Limpar seleção";

const CLEAR_PARAMS: BrushParams = {
  size: 1,
  hardness: 1,
  opacity: 1,
  flow: 1,
  color: { r: 0, g: 0, b: 0 },
  erase: true,
};

type Active = { session: StrokeSession; key: string; placement: MaskPlacement; label: string };

export type PaintCallbacks = {
  onPaintStart: (point: Point) => void;
  onPaintMove: (points: Point[]) => void;
  onPaintEnd: () => void;
};

export type DesignPaint = {
  brush: BrushController;
  fill: FillController;
  reason: string | undefined;
  callbacks: PaintCallbacks;
  cursorDiameter: (tool: DesignTool, zoom: number) => number | null;
  clearSelected: (label?: string) => void;
};

export const useDesignPaint = ({
  tool,
  editor,
  rasters,
  pixels,
  colors,
  brush,
  size,
  canPaint,
  selection,
  masks,
}: {
  tool: DesignTool;
  editor: DesignEditor;
  rasters: RasterHandle;
  pixels: PixelHistorySession;
  colors: DesignColors;
  brush: BrushController;
  size: PageSize;
  canPaint: boolean;
  selection: SelectionController;
  masks: MaskController;
}): DesignPaint => {
  const { store } = rasters;
  const active = useRef<Active | null>(null);
  const frame = useRef<number | null>(null);
  const single = editor.single;
  const raster = single?.kind === DesignElementKind.Raster ? single : null;
  const layerReady = raster !== null && !raster.locked && !raster.hidden;
  const target = layerReady && canPaint ? raster : null;
  const masked = canPaint ? masks.paintTarget() : null;
  const drawTarget: PaintTarget | null =
    masked ?? (target === null ? null : { key: target.id, placement: target, mask: false });
  const fill = useDesignFill({
    tool,
    editor,
    rasters,
    pixels,
    colors,
    selection,
    target: drawTarget,
  });
  const reason =
    isBrushTool(tool) || isFillTool(tool)
      ? paintReason(canPaint, layerReady || masked !== null)
      : undefined;

  const cancelFrame = () => {
    if (frame.current === null) return;
    cancelAnimationFrame(frame.current);
    frame.current = null;
  };

  useEffect(() => cancelFrame, []);

  const schedule = (id: string) => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      store.markChanged(id);
    });
  };

  const take = (color: RgbaColor | null) => {
    if (color === null || color.a === 0) return;
    colors.setForeground(rgbToHex(color.r, color.g, color.b));
  };

  const sampleLayer = (point: Point) => {
    const buffer = raster === null ? undefined : store.get(raster.id);
    if (raster === null || buffer === undefined) return;
    const local = docToLayerPoint(raster, point);
    take(sampleColor(buffer, Math.floor(local.x), Math.floor(local.y), SampleSize.Single));
  };

  const sampleAll = (point: Point) => {
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    if (x < 0 || y < 0 || x >= size.width || y >= size.height) return;
    take(sampleCompositeAt(resolveInheritance(editor.page), store, x, y, SampleSize.Single));
  };

  const sample = (point: Point) =>
    brush.sample === PaintSampleMode.Layer ? sampleLayer(point) : sampleAll(point);

  const begin = (point: Point) => {
    if (!isBrushTool(tool) || drawTarget === null || colors.foreground === null) return;
    const buffer = store.get(drawTarget.key);
    const erase = tool === DesignTool.Eraser;
    const source = drawTarget.mask && erase ? colors.background : colors.foreground;
    const picked = source === null ? null : hexToRgb(source);
    if (buffer === undefined || picked === null) return;
    const rgb = drawTarget.mask ? grayColor(grayOf(picked)) : picked;
    const options = brush.optionsOf(tool);
    const params = {
      ...toBrushParams(options, rgb, erase && !drawTarget.mask),
      selection: selection.layerMask(drawTarget.placement),
    };
    const session = createStrokeSession(buffer, params, options);
    active.current = {
      session,
      key: drawTarget.key,
      placement: drawTarget.placement,
      label: drawTarget.mask ? MASK_PAINT_LABEL : DESIGN_TOOL_LABEL[tool],
    };
    pixels.stroking.current = true;
    session.move([docToLayerPoint(drawTarget.placement, point)]);
    schedule(drawTarget.key);
  };

  const onPaintStart = (point: Point) => {
    if (isFillTool(tool)) {
      fill.onStart(point);
      return;
    }
    if (tool === DesignTool.Eyedropper) {
      sample(point);
      return;
    }
    begin(point);
  };

  const onPaintMove = (points: Point[]) => {
    if (isFillTool(tool)) {
      fill.onMove(points);
      return;
    }
    const current = active.current;
    const last = points.at(-1);
    if (tool === DesignTool.Eyedropper && last !== undefined) {
      sample(last);
      return;
    }
    if (current === null) return;
    current.session.move(points.map((point) => docToLayerPoint(current.placement, point)));
    schedule(current.key);
  };

  const onPaintEnd = () => {
    if (isFillTool(tool)) {
      fill.onEnd();
      return;
    }
    const current = active.current;
    active.current = null;
    pixels.stroking.current = false;
    if (current === null) return;
    cancelFrame();
    const patch = current.session.finish();
    store.markChanged(current.key);
    if (patch === null) return;
    const stepId = crypto.randomUUID();
    pixels.history.push(current.label, current.key, patch, stepId);
    editor.markPixelStep(current.label, stepId);
  };

  const clearSelected = (label = CLEAR_SELECTION_LABEL) => {
    if (target === null) return;
    const buffer = store.get(target.id);
    if (buffer === undefined) return;
    const mask = selection.layerMask(target) ?? selectAllMask(buffer.width, buffer.height);
    const stroke = beginStroke(buffer);
    const params = {
      ...CLEAR_PARAMS,
      size: Math.hypot(buffer.width, buffer.height) + 2,
      selection: mask,
    };
    stampDab(buffer, buffer.width / 2, buffer.height / 2, params, stroke);
    const patch = finishStroke(stroke);
    store.markChanged(target.id);
    if (patch.tiles.length === 0) return;
    const stepId = crypto.randomUUID();
    pixels.history.push(label, target.id, patch, stepId);
    editor.markPixelStep(label, stepId);
  };

  const cursorDiameter = (activeTool: DesignTool, zoom: number): number | null => {
    if (!isBrushTool(activeTool)) return null;
    const scale = drawTarget === null ? 1 : layerScale(drawTarget.placement);
    return cursorDiameterPx(brush.optionsOf(activeTool), scale * zoom);
  };

  return {
    brush,
    fill,
    reason,
    callbacks: { onPaintStart, onPaintMove, onPaintEnd },
    cursorDiameter,
    clearSelected,
  };
};
