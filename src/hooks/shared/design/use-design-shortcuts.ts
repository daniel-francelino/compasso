import { useEffect, useRef } from "react";
import type { BrushController } from "@/hooks/shared/design/use-brush-options";
import type { ClipboardController } from "@/hooks/shared/design/use-design-clipboard";
import type { CropController } from "@/hooks/shared/design/use-design-crop";
import type { DesignColors } from "@/hooks/shared/design/use-design-colors";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignToolState } from "@/hooks/shared/design/use-design-tool";
import type { DesignViewport } from "@/hooks/shared/design/use-design-viewport";
import type { DesignPaint } from "@/hooks/shared/design/use-design-paint";
import type { SelectionController } from "@/hooks/shared/design/use-design-selection";
import { isControlTarget, isTypingTarget } from "@/lib/shared/design/browser";
import { isBrushTool, isPaintTool } from "@/lib/shared/design/paint";
import { isSelectionTool } from "@/lib/shared/design/selection-state";
import {
  DESIGN_DUPLICATE_KEY,
  DESIGN_CLIP_KEY,
  DESIGN_ENABLED_TOOLS,
  DESIGN_FILL_KEY,
  DESIGN_IMAGE_KEY,
  DESIGN_LIMITS,
  DESIGN_MARQUEE_KEY,
  DESIGN_SHAPE_KEY,
  DESIGN_TOOL_KEY,
  DesignElementKind,
  DesignTool,
  isShapeTool,
  nextShapeTool,
} from "@/lib/shared/design/types";

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const TOOL_BY_KEY = new Map(
  DESIGN_ENABLED_TOOLS.filter((tool) => !isShapeTool(tool))
    .reverse()
    .map((tool) => [DESIGN_TOOL_KEY[tool], tool] as const),
);

type Context = {
  editor: DesignEditor;
  tool: DesignToolState;
  viewport: DesignViewport;
  editable: boolean;
  colors: DesignColors;
  brush: BrushController;
  selection: SelectionController;
  paint: DesignPaint;
  crop: CropController;
  clipboard: ClipboardController;
  onImage: () => void;
  onTransform: () => void;
};

const viewKey = (key: string, viewport: DesignViewport): boolean => {
  const actions: Record<string, () => void> = {
    "0": viewport.fit,
    "1": viewport.actualSize,
    "=": () => viewport.step(1),
    "+": () => viewport.step(1),
    "-": () => viewport.step(-1),
  };
  const action = actions[key];
  if (action === undefined) return false;
  action();
  return true;
};

const editKey = (event: KeyboardEvent, editor: DesignEditor): boolean => {
  const key = event.key.toLowerCase();
  const shift = event.shiftKey;
  const actions: Record<string, () => void> = {
    z: shift ? editor.redo : editor.undo,
    y: editor.redo,
    g: shift ? editor.ungroup : editor.group,
    a: editor.selectAll,
    d: () => editor.duplicate(editor.selectedIds),
    [DESIGN_DUPLICATE_KEY]: () => editor.duplicate(editor.selectedIds),
  };
  const action = actions[key];
  if (action === undefined) return false;
  const duplicates = key === "d" || key === DESIGN_DUPLICATE_KEY;
  if (duplicates && editor.selectedIds.length === 0) return false;
  action();
  return true;
};

const imageKey = (event: KeyboardEvent, context: Context): boolean => {
  if (!event.shiftKey || event.key.toLowerCase() !== DESIGN_IMAGE_KEY) return false;
  if (!context.editable) return false;
  context.onImage();
  return true;
};

const isPixelTool = (tool: DesignTool): boolean => isPaintTool(tool) || isSelectionTool(tool);

const selectionCommand = (event: KeyboardEvent, context: Context): boolean => {
  if (!context.editable) return false;
  const { selection, tool } = context;
  const key = event.key.toLowerCase();
  if (key === "a" && !event.shiftKey && isPixelTool(tool.tool)) {
    selection.selectAll();
    return true;
  }
  if (key === "d" && !event.shiftKey && selection.mask !== null) {
    selection.deselect();
    return true;
  }
  if (key === "i" && event.shiftKey && selection.mask !== null) {
    selection.invert();
    return true;
  }
  return false;
};

const startTransform = ({ editor, onTransform }: Context): boolean => {
  const layer = editor.single;
  if (layer?.kind !== DesignElementKind.Raster || layer.locked || layer.hidden) return false;
  onTransform();
  return true;
};

const clipboardKey = (event: KeyboardEvent, context: Context): boolean => {
  if (!context.editable) return false;
  const { clipboard, selection, editor } = context;
  const key = event.key.toLowerCase();
  const viaLayer = key === DESIGN_DUPLICATE_KEY && (event.shiftKey || selection.mask !== null);
  if (viaLayer && editor.single?.kind === DesignElementKind.Raster) {
    (event.shiftKey ? clipboard.layerViaCut : clipboard.layerViaCopy)();
    return true;
  }
  if (key === "t" && !event.shiftKey) return startTransform(context);
  if (key === "v" && event.shiftKey) {
    clipboard.paste(true);
    return true;
  }
  if (event.shiftKey) return false;
  if (key !== "c" && key !== "x") return false;
  if (editor.single?.kind !== DesignElementKind.Raster) return false;
  if (key === "c") clipboard.copy();
  else clipboard.cut();
  return true;
};

const commandKey = (event: KeyboardEvent, context: Context): boolean => {
  if (context.editor.transforming) return false;
  if (clipboardKey(event, context)) return true;
  if (viewKey(event.key, context.viewport)) return true;
  if (imageKey(event, context)) return true;
  if (selectionCommand(event, context)) return true;
  return context.editable && editKey(event, context.editor);
};

const modalKey = (event: KeyboardEvent, { editor, crop }: Context): boolean => {
  const confirm = event.key === "Enter";
  if (!confirm && event.key !== "Escape") return false;
  const mode = editor.transforming
    ? { commit: editor.commitTransform, cancel: editor.cancelTransform }
    : crop.active
      ? { commit: crop.commit, cancel: crop.cancel }
      : null;
  if (mode === null) return false;
  (confirm ? mode.commit : mode.cancel)();
  return true;
};

const escape = ({ editor, tool, selection }: Context): boolean => {
  if (selection.drawing) {
    selection.cancelDraft();
    return true;
  }
  if (tool.tool !== DesignTool.Move) {
    tool.reset();
    return true;
  }
  if (editor.selected.length === 0) return false;
  editor.select(null);
  return true;
};

const shapeKey = (event: KeyboardEvent, { tool }: Context): boolean => {
  if (event.key.toLowerCase() !== DESIGN_SHAPE_KEY) return false;
  const current = isShapeTool(tool.tool) ? tool.tool : tool.lastShape;
  tool.setTool(event.shiftKey ? nextShapeTool(current) : tool.lastShape);
  return true;
};

const marqueeKey = (event: KeyboardEvent, { tool, selection }: Context): boolean => {
  if (event.key.toLowerCase() !== DESIGN_MARQUEE_KEY || !event.shiftKey) return false;
  if (tool.tool === DesignTool.Marquee) selection.cycleShape();
  tool.setTool(DesignTool.Marquee);
  return true;
};

const fillKey = (event: KeyboardEvent, { tool }: Context): boolean => {
  if (event.key.toLowerCase() !== DESIGN_FILL_KEY || !event.shiftKey) return false;
  tool.setTool(tool.tool === DesignTool.Fill ? DesignTool.Gradient : DesignTool.Fill);
  return true;
};

const clipKey = (event: KeyboardEvent, { editor }: Context): boolean => {
  if (!event.ctrlKey || !event.altKey || event.shiftKey || event.code !== DESIGN_CLIP_KEY) {
    return false;
  }
  editor.toggleClip();
  return true;
};

const pixelsKey = (event: KeyboardEvent, { selection, paint, editor }: Context): boolean => {
  if (event.key === "Enter" && selection.drawing) {
    selection.closePolygon();
    return true;
  }
  if (event.key === "Backspace" && selection.drawing) {
    selection.removeLastPoint();
    return true;
  }
  const raster = editor.single?.kind === DesignElementKind.Raster;
  if (event.key !== "Delete" || selection.mask === null || !raster) return false;
  paint.clearSelected();
  return true;
};

const toolKey = (event: KeyboardEvent, context: Context): boolean => {
  if (event.altKey) return false;
  if (fillKey(event, context)) return true;
  if (marqueeKey(event, context)) return true;
  if (shapeKey(event, context)) return true;
  if (event.shiftKey) return false;
  const key = event.key.toLowerCase();
  const next = TOOL_BY_KEY.get(key);
  if (next === undefined) return false;
  context.tool.setTool(next);
  return true;
};

const isAltGraph = (event: KeyboardEvent): boolean =>
  event.ctrlKey && event.altKey && !event.metaKey;

const paintKey = (event: KeyboardEvent, { tool, colors, brush }: Context): boolean => {
  if (event.altKey && !isAltGraph(event)) return false;
  const key = event.key.toLowerCase();
  if (key === "x" && !event.shiftKey && !event.repeat) {
    colors.swap();
    return true;
  }
  if (key === "d" && !event.shiftKey && !event.repeat) {
    colors.reset();
    return true;
  }
  if (!isBrushTool(tool.tool)) return false;
  return brush.adjustByKey(tool.tool, event.key, event.shiftKey, event.code);
};

const selectionKey = (event: KeyboardEvent, editor: DesignEditor): boolean => {
  const movable = editor.selected.filter((element) => !element.locked);
  if (movable.length === 0) return false;
  if (event.key === "Delete" || event.key === "Backspace") {
    editor.remove(movable.map((element) => element.id));
    return true;
  }
  const arrow = ARROWS[event.key];
  if (arrow === undefined) return false;
  const step = event.shiftKey ? DESIGN_LIMITS.nudgeLarge : DESIGN_LIMITS.nudge;
  editor.patchMany(
    movable.map((element) => ({
      id: element.id,
      patch: { x: element.x + arrow[0] * step, y: element.y + arrow[1] * step },
    })),
    `nudge:${editor.selectedIds.join(",")}`,
  );
  return true;
};

const plainKey = (event: KeyboardEvent, context: Context): boolean => {
  if (!context.editable) return false;
  if (modalKey(event, context)) return true;
  if (context.editor.transforming) return false;
  if (event.key === "Escape") return escape(context);
  return (
    clipKey(event, context) ||
    pixelsKey(event, context) ||
    toolKey(event, context) ||
    paintKey(event, context) ||
    selectionKey(event, context.editor)
  );
};

export const useDesignShortcuts = (context: Context) => {
  const latest = useRef(context);
  latest.current = context;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const current = latest.current;
      if (event.code === "Space" && !isControlTarget(event.target)) {
        event.preventDefault();
        current.tool.hold(true);
        return;
      }
      const modifier = (event.ctrlKey && !isAltGraph(event)) || event.metaKey;
      const handled = modifier ? commandKey(event, current) : plainKey(event, current);
      if (handled) event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") latest.current.tool.hold(false);
    };
    const onBlur = () => latest.current.tool.hold(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
};
