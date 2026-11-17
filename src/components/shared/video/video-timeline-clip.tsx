import { useRef } from "react";
import type { VideoEditor } from "@/hooks/shared/video/use-video-editor";
import { cn } from "@/lib/shared/utils";
import type { VideoDocument } from "@/lib/shared/video/schemas";
import {
  type TimedClip,
  findTimed,
  formatTimecode,
  sameRef,
  snapTargetsOf,
  snapValue,
} from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS, VideoTrack, VideoTrimEdge } from "@/lib/shared/video/types";

const DRAG_THRESHOLD_PX = 3;

type Gesture = {
  pointerId: number;
  originX: number;
  base: VideoDocument;
  clip: TimedClip;
  edge: VideoTrimEdge | null;
  key: string;
  moved: boolean;
};

const TRACK_STYLE: Record<VideoTrack, string> = {
  [VideoTrack.Main]: "bg-violet/20 border-violet",
  [VideoTrack.Overlay]: "bg-peach/40 border-coral",
  [VideoTrack.Text]: "bg-sage/40 border-cactus",
  [VideoTrack.Audio]: "bg-orchid-light/50 border-orchid",
};

export function VideoTimelineClip({
  clip,
  label,
  editor,
  zoom,
  playheadMs,
  sourceDurationMs,
  editable,
}: {
  clip: TimedClip;
  label: string;
  editor: VideoEditor;
  zoom: number;
  playheadMs: () => number;
  sourceDurationMs: number | null;
  editable: boolean;
}) {
  const gesture = useRef<Gesture | null>(null);
  const selected = sameRef(editor.selected, clip);
  const movable = editable && clip.track !== VideoTrack.Main;

  const begin = (event: React.PointerEvent<HTMLElement>, edge: VideoTrimEdge | null) => {
    editor.select({ track: clip.track, id: clip.id });
    if (!editable || (edge === null && !movable)) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      base: editor.document,
      clip,
      edge,
      key: `drag:${clip.id}:${event.timeStamp}`,
      moved: false,
    };
  };

  const move = (event: React.PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.originX;
    if (!current.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    current.moved = true;
    const targets = snapTargetsOf(current.base, current.clip, playheadMs());
    const threshold = VIDEO_LIMITS.snapScreenPx / zoom;
    const delta = dx / zoom;
    const start = current.clip.startMs;
    const end = start + current.clip.durationMs;
    if (current.edge === null) {
      const snappedStart = snapValue(start + delta, targets, threshold);
      const snappedEnd = snapValue(end + delta, targets, threshold);
      const next =
        Math.abs(snappedEnd - (end + delta)) < Math.abs(snappedStart - (start + delta))
          ? snappedEnd - current.clip.durationMs
          : snappedStart;
      editor.moveStart(current.clip, next, current.key);
      return;
    }
    const edgeMs = current.edge === VideoTrimEdge.Start ? start : end;
    const snapped = snapValue(edgeMs + delta, targets, threshold) - edgeMs;
    editor.trim(current.clip, current.edge, snapped, sourceDurationMs, current.base, current.key);
  };

  const end = (event: React.PointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
  };

  const timed = findTimed(editor.document, clip) ?? clip;
  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 flex overflow-hidden rounded border text-xs",
        TRACK_STYLE[clip.track],
        selected && "ring-2 ring-ring ring-offset-1",
      )}
      style={{ left: timed.startMs * zoom, width: Math.max(4, timed.durationMs * zoom) }}
    >
      {editable ? (
        <div
          aria-hidden="true"
          className="w-2 shrink-0 cursor-ew-resize bg-foreground/10 hover:bg-foreground/30"
          onPointerDown={(event) => begin(event, VideoTrimEdge.Start)}
          {...handlers}
        />
      ) : null}
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${label}, de ${formatTimecode(timed.startMs)} a ${formatTimecode(timed.startMs + timed.durationMs)}`}
        className={cn(
          "min-w-0 flex-1 truncate px-1 text-left text-foreground focus-visible:outline-2 focus-visible:outline-ring",
          movable && "cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={(event) => begin(event, null)}
        onClick={() => editor.select({ track: clip.track, id: clip.id })}
        {...handlers}
      >
        {label}
      </button>
      {editable ? (
        <div
          aria-hidden="true"
          className="w-2 shrink-0 cursor-ew-resize bg-foreground/10 hover:bg-foreground/30"
          onPointerDown={(event) => begin(event, VideoTrimEdge.End)}
          {...handlers}
        />
      ) : null}
    </div>
  );
}
