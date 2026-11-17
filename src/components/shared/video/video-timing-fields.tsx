import { FormInputNumber } from "lost-ui/forms/form-input-number";
import type { VideoEditor } from "@/hooks/shared/video/use-video-editor";
import type { TimedClip } from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS, VideoTrack, VideoTrimEdge } from "@/lib/shared/video/types";

const STEP = 0.1;

const toSeconds = (ms: number) => Math.round(ms / 100) / 10;
const toMs = (seconds: number) => Math.round(seconds * 1000);

export function VideoTimingFields({
  clip,
  sourceInMs,
  sourceDurationMs,
  editor,
  disabled,
}: {
  clip: TimedClip;
  sourceInMs: number | null;
  sourceDurationMs: number | null;
  editor: VideoEditor;
  disabled: boolean;
}) {
  const movable = clip.track !== VideoTrack.Main;
  const maxSourceIn =
    sourceDurationMs === null ? VIDEO_LIMITS.maxSourceMs : sourceDurationMs - clip.durationMs;

  const setDuration = (seconds: number | null) => {
    if (seconds === null) return;
    const delta = toMs(seconds) - clip.durationMs;
    editor.trim(
      clip,
      VideoTrimEdge.End,
      delta,
      sourceDurationMs,
      editor.document,
      `duration:${clip.id}`,
    );
  };

  const setSourceIn = (seconds: number | null) => {
    if (seconds === null) return;
    const value = Math.min(Math.max(0, toMs(seconds)), Math.max(0, maxSourceIn));
    if (clip.track === VideoTrack.Main) {
      editor.patchMain(clip.id, { sourceInMs: value }, `source:${clip.id}`);
      return;
    }
    editor.patchAudio(clip.id, { sourceInMs: value }, `source:${clip.id}`);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {movable ? (
        <FormInputNumber
          name="startSeconds"
          label="Início (s)"
          value={toSeconds(clip.startMs)}
          min={0}
          max={toSeconds(VIDEO_LIMITS.maxDurationMs - VIDEO_LIMITS.minClipMs)}
          step={STEP}
          disabled={disabled}
          onValueChange={(value) =>
            value !== null && editor.moveStart(clip, toMs(value), `start:${clip.id}`)
          }
        />
      ) : null}
      <FormInputNumber
        name="durationSeconds"
        label="Duração (s)"
        value={toSeconds(clip.durationMs)}
        min={toSeconds(VIDEO_LIMITS.minClipMs)}
        max={toSeconds(VIDEO_LIMITS.maxDurationMs)}
        step={STEP}
        disabled={disabled}
        onValueChange={setDuration}
      />
      {sourceInMs === null ? null : (
        <FormInputNumber
          name="sourceInSeconds"
          label="Início no arquivo (s)"
          value={toSeconds(sourceInMs)}
          min={0}
          max={toSeconds(Math.max(0, maxSourceIn))}
          step={STEP}
          disabled={disabled}
          onValueChange={setSourceIn}
        />
      )}
    </div>
  );
}
