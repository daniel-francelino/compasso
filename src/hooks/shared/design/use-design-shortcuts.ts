import { useEffect, useRef } from "react";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { isTypingTarget } from "@/lib/shared/design/browser";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const commandKey = (event: KeyboardEvent, editor: DesignEditor): boolean => {
  const key = event.key.toLowerCase();
  if (key === "z" && event.shiftKey) {
    editor.redo();
    return true;
  }
  if (key === "z") {
    editor.undo();
    return true;
  }
  if (key === "y") {
    editor.redo();
    return true;
  }
  if (key === "g" && event.shiftKey) {
    editor.ungroup();
    return true;
  }
  if (key === "g") {
    editor.group();
    return true;
  }
  if (key !== "d" || editor.selectedIds.length === 0) return false;
  editor.duplicate(editor.selectedIds);
  return true;
};

const selectionKey = (event: KeyboardEvent, editor: DesignEditor): boolean => {
  if (editor.selected.length === 0) return false;
  if (event.key === "Escape") {
    editor.select(null);
    return true;
  }
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

export const useDesignShortcuts = (editor: DesignEditor, enabled: boolean) => {
  const latest = useRef(editor);
  latest.current = editor;

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const current = latest.current;
      const modifier = event.ctrlKey || event.metaKey;
      const handled = modifier ? commandKey(event, current) : selectionKey(event, current);
      if (handled) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
};
