import { useRef, useState } from "react";
import type { BrushController } from "@/hooks/shared/design/use-brush-options";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { SelectionController } from "@/hooks/shared/design/use-design-selection";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import type { PixelHistorySession } from "@/hooks/shared/design/use-pixel-history";
import type { PaintTarget } from "@/lib/shared/design/layer-mask";
import {
  type PaintInput,
  type PaintSample,
  docToLayerPoint,
  isBrushTool,
  toBrushParams,
} from "@/lib/shared/design/paint";
import { ToneRange } from "@/lib/shared/design/raster/adjustment-types";
import { type DabStamp, stampShaded } from "@/lib/shared/design/raster/brush";
import type { Point } from "@/lib/shared/design/raster/pixel-buffer";
import { ToneMode, cloneOffset, cloneShader, toneShader } from "@/lib/shared/design/raster/retouch";
import { type StrokeSession, createStrokeSession } from "@/lib/shared/design/stroke-session";
import { DESIGN_TOOL_LABEL, DesignTool } from "@/lib/shared/design/types";

export type RetouchOptions = { aligned: boolean; range: ToneRange; exposure: number };

export const DEFAULT_RETOUCH_OPTIONS: RetouchOptions = {
  aligned: true,
  range: ToneRange.Midtones,
  exposure: 50,
};

const BLACK = { r: 0, g: 0, b: 0 };

type Source = { key: string; point: Point };

type Active = {
  session: StrokeSession;
  key: string;
  placement: PaintTarget["placement"];
  label: string;
};

export const useDesignRetouch = ({
  tool,
  editor,
  rasters,
  pixels,
  brush,
  selection,
  target,
  schedule,
}: {
  tool: DesignTool;
  editor: DesignEditor;
  rasters: RasterHandle;
  pixels: PixelHistorySession;
  brush: BrushController;
  selection: SelectionController;
  target: PaintTarget | null;
  schedule: (id: string) => void;
}) => {
  const [options, setOptions] = useState<RetouchOptions>(DEFAULT_RETOUCH_OPTIONS);
  const [source, setSourceState] = useState<Source | null>(null);
  const offset = useRef<Point | null>(null);
  const active = useRef<Active | null>(null);
  const { store } = rasters;

  const setSource = (next: Source | null) => {
    offset.current = null;
    setSourceState(next);
  };

  const hasSource = target !== null && source !== null && source.key === target.key;

  const cloneStamp = (current: PaintTarget, start: Point): DabStamp | null => {
    if (source === null || source.key !== current.key) return null;
    const shift =
      options.aligned && offset.current !== null
        ? offset.current
        : cloneOffset(source.point, start);
    offset.current = shift;
    return (stroke, x, y, params) => stampShaded(stroke, x, y, params, cloneShader(stroke, shift));
  };

  const toneStamp = (): DabStamp => {
    const shade = toneShader({
      mode: tool === DesignTool.Dodge ? ToneMode.Dodge : ToneMode.Burn,
      range: options.range,
      exposure: options.exposure / 100,
    });
    return (stroke, x, y, params) => stampShaded(stroke, x, y, params, shade);
  };

  const onStart = (point: Point, input: PaintInput) => {
    if (target === null || !isBrushTool(tool)) return;
    const local = docToLayerPoint(target.placement, point);
    if (tool === DesignTool.Clone && input.alt) {
      setSource({ key: target.key, point: local });
      return;
    }
    const buffer = store.get(target.key);
    if (buffer === undefined) return;
    const stamp = tool === DesignTool.Clone ? cloneStamp(target, local) : toneStamp();
    if (stamp === null) return;
    const brushOptions = brush.optionsOf(tool);
    const params = {
      ...toBrushParams(brushOptions, BLACK, false),
      selection: selection.layerMask(target.placement),
    };
    const session = createStrokeSession(buffer, params, brushOptions, {
      pressure: brush.pressure,
      stamp,
    });
    active.current = {
      session,
      key: target.key,
      placement: target.placement,
      label: DESIGN_TOOL_LABEL[tool],
    };
    pixels.stroking.current = true;
    session.move([{ ...local, pressure: input.pressure }]);
    schedule(target.key);
  };

  const onMove = (points: PaintSample[]) => {
    const current = active.current;
    if (current === null) return;
    current.session.move(
      points.map((item) => ({
        ...docToLayerPoint(current.placement, item),
        pressure: item.pressure,
      })),
    );
    schedule(current.key);
  };

  const onEnd = () => {
    const current = active.current;
    active.current = null;
    pixels.stroking.current = false;
    if (current === null) return;
    const patch = current.session.finish();
    store.markChanged(current.key);
    if (patch === null) return;
    const stepId = crypto.randomUUID();
    pixels.history.push(current.label, current.key, patch, stepId);
    editor.markPixelStep(current.label, stepId);
  };

  return {
    options,
    setOptions: (patch: Partial<RetouchOptions>) =>
      setOptions((current) => ({ ...current, ...patch })),
    hasSource,
    clearSource: () => setSource(null),
    onStart,
    onMove,
    onEnd,
  };
};

export type RetouchController = ReturnType<typeof useDesignRetouch>;
