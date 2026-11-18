import { useRef, useState } from "react";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import type { DesignColors } from "@/hooks/shared/design/use-design-colors";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { PixelHistorySession } from "@/hooks/shared/design/use-pixel-history";
import type { SelectionController } from "@/hooks/shared/design/use-design-selection";
import {
  type BucketToolOptions,
  DEFAULT_BUCKET_TOOL_OPTIONS,
  DEFAULT_GRADIENT_OPTIONS,
  FILL_HISTORY_LABEL,
  GRADIENT_HISTORY_LABEL,
  type GradientOptions,
  GradientKind,
  clampPercent,
  clampTolerance,
} from "@/lib/shared/design/fill-tools";
import {
  type PaintTarget,
  grayColor,
  grayOf,
  MASK_PAINT_LABEL,
} from "@/lib/shared/design/layer-mask";
import { docToLayerPoint, hexToRgb } from "@/lib/shared/design/paint";
import { bucketPatch, gradientPatch } from "@/lib/shared/design/raster/fill-edit";
import type { PixelPatch } from "@/lib/shared/design/raster/pixel-history";
import type { Point, RgbaColor } from "@/lib/shared/design/raster/pixel-buffer";
import { DesignTool } from "@/lib/shared/design/types";

const MIN_GRADIENT_PX = 1;

const toColor = (hex: string | null, gray = false): RgbaColor | null => {
  const rgb = hex === null ? null : hexToRgb(hex);
  if (rgb === null) return null;
  return gray ? grayColor(grayOf(rgb)) : { ...rgb, a: 255 };
};

export const useDesignFill = ({
  tool,
  editor,
  rasters,
  pixels,
  colors,
  selection,
  target,
}: {
  tool: DesignTool;
  editor: DesignEditor;
  rasters: RasterHandle;
  pixels: PixelHistorySession;
  colors: DesignColors;
  selection: SelectionController;
  target: PaintTarget | null;
}) => {
  const [bucket, setBucket] = useState<BucketToolOptions>(DEFAULT_BUCKET_TOOL_OPTIONS);
  const [gradient, setGradient] = useState<GradientOptions>(DEFAULT_GRADIENT_OPTIONS);
  const drag = useRef<{ start: Point; end: Point } | null>(null);
  const { store } = rasters;

  const record = (label: string, id: string, patch: PixelPatch | null) => {
    store.markChanged(id);
    if (patch === null) return;
    const stepId = crypto.randomUUID();
    pixels.history.push(label, id, patch, stepId);
    editor.markPixelStep(label, stepId);
  };

  const fillAt = (point: Point) => {
    const buffer = target === null ? undefined : store.get(target.key);
    const color = toColor(colors.foreground, target?.mask === true);
    if (target === null || buffer === undefined || color === null) return;
    const local = docToLayerPoint(target.placement, point);
    const patch = bucketPatch(buffer, Math.floor(local.x), Math.floor(local.y), color, {
      tolerance: bucket.tolerance,
      contiguous: bucket.contiguous,
      opacity: bucket.opacity / 100,
      blendMode: bucket.blendMode,
      selection: selection.layerMask(target.placement),
    });
    record(target.mask ? MASK_PAINT_LABEL : FILL_HISTORY_LABEL, target.key, patch);
  };

  const finishGradient = () => {
    const current = drag.current;
    drag.current = null;
    const buffer = target === null ? undefined : store.get(target.key);
    const first = toColor(colors.foreground, target?.mask === true);
    const second = toColor(colors.background, target?.mask === true);
    if (current === null || target === null || buffer === undefined) return;
    if (first === null || second === null) return;
    const from = docToLayerPoint(target.placement, current.start);
    const to = docToLayerPoint(target.placement, current.end);
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length < MIN_GRADIENT_PX) return;
    const [start, end] = gradient.reverse ? [second, first] : [first, second];
    const shape =
      gradient.kind === GradientKind.Linear
        ? ({ kind: "linear", from, to } as const)
        : ({ kind: "radial", center: from, radius: length } as const);
    const patch = gradientPatch(
      buffer,
      shape,
      start,
      end,
      { opacity: gradient.opacity / 100, blendMode: gradient.blendMode },
      selection.layerMask(target.placement),
    );
    record(target.mask ? MASK_PAINT_LABEL : GRADIENT_HISTORY_LABEL, target.key, patch);
  };

  const onStart = (point: Point) => {
    if (target === null) return;
    if (tool === DesignTool.Fill) fillAt(point);
    else drag.current = { start: point, end: point };
  };

  const onMove = (points: Point[]) => {
    const last = points.at(-1);
    if (drag.current !== null && last !== undefined) drag.current.end = last;
  };

  return {
    bucket,
    gradient,
    setBucket: (patch: Partial<BucketToolOptions>) =>
      setBucket((current) => ({
        ...current,
        ...patch,
        ...(patch.tolerance === undefined ? {} : { tolerance: clampTolerance(patch.tolerance) }),
        ...(patch.opacity === undefined ? {} : { opacity: clampPercent(patch.opacity) }),
      })),
    setGradient: (patch: Partial<GradientOptions>) =>
      setGradient((current) => ({
        ...current,
        ...patch,
        ...(patch.opacity === undefined ? {} : { opacity: clampPercent(patch.opacity) }),
      })),
    onStart,
    onMove,
    onEnd: finishGradient,
  };
};

export type FillController = ReturnType<typeof useDesignFill>;
