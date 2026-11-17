import { useEffect, useRef } from "react";
import type { VideoEditor } from "@/hooks/shared/video/use-video-editor";
import type { VideoPlayback } from "@/hooks/shared/video/use-video-playback";
import { isTypingTarget } from "@/lib/shared/design/browser";
import { canSplit, clipRefAt, findTimed } from "@/lib/shared/video/timeline";
import { VideoTrack } from "@/lib/shared/video/types";

const SECOND_MS = 1000;
const FRAME_STEP = 1;
const INTERACTIVE =
  '[role="slider"],[role="listbox"],[role="menu"],[role="tablist"],[role="dialog"]';

const ignored = (target: EventTarget | null): boolean => {
  if (isTypingTarget(target)) return true;
  return target instanceof HTMLElement && target.closest(INTERACTIVE) !== null;
};

const historyKey = (event: KeyboardEvent, editor: VideoEditor): boolean => {
  const key = event.key.toLowerCase();
  if ((key === "z" && event.shiftKey) || key === "y") {
    editor.redo();
    return true;
  }
  if (key !== "z") return false;
  editor.undo();
  return true;
};

const nudge = (
  event: KeyboardEvent,
  editor: VideoEditor,
  playback: VideoPlayback,
  direction: number,
) => {
  const ref = editor.selected;
  const timed = ref === null ? undefined : findTimed(editor.document, ref);
  if (ref !== null && timed !== undefined && ref.track !== VideoTrack.Main) {
    const step = event.shiftKey ? SECOND_MS : SECOND_MS / 30;
    editor.moveStart(ref, timed.startMs + direction * step, `nudge:${ref.id}`);
    return;
  }
  if (event.shiftKey) {
    playback.seek(playback.clock.get() + direction * SECOND_MS);
    return;
  }
  playback.step(direction * FRAME_STEP);
};

const splitAtPlayhead = (editor: VideoEditor, timeMs: number) => {
  const target = editor.selected ?? clipRefAt(editor.document, VideoTrack.Main, timeMs);
  if (target === undefined || !canSplit(editor.document, target, timeMs)) return;
  editor.split(target, timeMs);
};

const plainKey = (
  event: KeyboardEvent,
  editor: VideoEditor,
  playback: VideoPlayback,
  editable: boolean,
): boolean => {
  if (event.key === " " && !(event.target instanceof HTMLButtonElement)) {
    playback.toggle();
    return true;
  }
  if (event.key === "Home") {
    playback.seek(0);
    return true;
  }
  if (event.key === "End") {
    playback.seek(Number.MAX_SAFE_INTEGER);
    return true;
  }
  if (event.key === "Escape") {
    editor.select(null);
    return true;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    nudge(
      event,
      editable ? editor : { ...editor, selected: null },
      playback,
      event.key === "ArrowLeft" ? -1 : 1,
    );
    return true;
  }
  if (!editable) return false;
  if (event.key.toLowerCase() === "s") {
    splitAtPlayhead(editor, playback.clock.get());
    return true;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && editor.selected !== null) {
    editor.remove(editor.selected);
    return true;
  }
  return false;
};

export const useVideoShortcuts = (
  editor: VideoEditor,
  playback: VideoPlayback,
  editable: boolean,
) => {
  const latest = useRef({ editor, playback, editable });
  latest.current = { editor, playback, editable };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || ignored(event.target)) return;
      const current = latest.current;
      const command = event.ctrlKey || event.metaKey;
      const handled = command
        ? current.editable && historyKey(event, current.editor)
        : plainKey(event, current.editor, current.playback, current.editable);
      if (handled) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
