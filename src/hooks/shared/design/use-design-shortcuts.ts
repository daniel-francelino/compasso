import { useEffect, useRef } from "react";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignToolState } from "@/hooks/shared/design/use-design-tool";
import type { DesignViewport } from "@/hooks/shared/design/use-design-viewport";
import { isControlTarget, isTypingTarget } from "@/lib/shared/design/browser";
import {
  DESIGN_IMAGE_KEY,
  DESIGN_LIMITS,
  DESIGN_TOOL_KEY,
  DesignTool,
} from "@/lib/shared/design/types";

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const TOOL_BY_KEY = new Map(
  Object.values(DesignTool).map((tool) => [DESIGN_TOOL_KEY[tool], tool] as const),
);

type Context = {
  editor: DesignEditor;
  tool: DesignToolState;
  viewport: DesignViewport;
  editable: boolean;
  onImage: () => void;
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
  };
  const action = actions[key];
  if (action === undefined) return false;
  if (key === "d" && editor.selectedIds.length === 0) return false;
  action();
  return true;
};

const commandKey = (event: KeyboardEvent, context: Context): boolean => {
  if (viewKey(event.key, context.viewport)) return true;
  return context.editable && editKey(event, context.editor);
};

const escape = ({ editor, tool }: Context): boolean => {
  if (tool.tool !== DesignTool.Move) {
    tool.reset();
    return true;
  }
  if (editor.selected.length === 0) return false;
  editor.select(null);
  return true;
};

const toolKey = (event: KeyboardEvent, context: Context): boolean => {
  if (event.altKey || event.shiftKey) return false;
  const key = event.key.toLowerCase();
  if (key === DESIGN_IMAGE_KEY) {
    context.onImage();
    return true;
  }
  const next = TOOL_BY_KEY.get(key);
  if (next === undefined) return false;
  context.tool.setTool(next);
  return true;
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
  if (event.key === "Escape") return escape(context);
  return toolKey(event, context) || selectionKey(event, context.editor);
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
      const modifier = event.ctrlKey || event.metaKey;
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
