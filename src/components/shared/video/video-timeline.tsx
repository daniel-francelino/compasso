import { ZoomIn, ZoomOut } from "lucide-react";
import { useSyncExternalStore } from "react";
import { VideoTimelineClip } from "@/components/shared/video/video-timeline-clip";
import { Button } from "@/components/shared/ui/button";
import type { VideoEditor } from "@/hooks/shared/video/use-video-editor";
import type { VideoPlayback } from "@/hooks/shared/video/use-video-playback";
import { clipLabel } from "@/lib/shared/video/labels";
import { type TimedClip, timedClips } from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS, VIDEO_TRACK_LABEL, VideoTrack } from "@/lib/shared/video/types";

const TRACKS = Object.values(VideoTrack);
const MIN_VISIBLE_MS = 15000;
const TAIL_MS = 5000;
const ZOOM_FACTOR = 1.5;

const tickStep = (zoom: number) => (zoom >= 0.05 ? 1000 : 5000);

function Playhead({ playback, zoom }: { playback: VideoPlayback; zoom: number }) {
  const time = useSyncExternalStore(playback.clock.subscribe, playback.clock.get, () => 0);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-destructive"
      style={{ left: time * zoom }}
    />
  );
}

function Ruler({
  widthMs,
  zoom,
  onSeek,
}: {
  widthMs: number;
  zoom: number;
  onSeek: (ms: number) => void;
}) {
  const step = tickStep(zoom);
  const ticks = Array.from({ length: Math.floor(widthMs / step) + 1 }, (_, index) => index * step);
  const seekFrom = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onSeek((event.clientX - box.left) / zoom);
  };
  return (
    <div
      aria-hidden="true"
      className="relative h-6 cursor-pointer border-b text-[10px] text-muted-foreground select-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFrom(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) seekFrom(event);
      }}
    >
      {ticks.map((ms) => (
        <span
          key={ms}
          className="absolute top-0 h-full border-l border-line pl-0.5"
          style={{ left: ms * zoom }}
        >
          {ms % (step * 5) === 0 ? `${ms / 1000}s` : ""}
        </span>
      ))}
    </div>
  );
}

export function VideoTimeline({
  editor,
  playback,
  durationMs,
  editable,
  sourceDurations,
  zoom,
  onZoom,
}: {
  editor: VideoEditor;
  playback: VideoPlayback;
  durationMs: number;
  editable: boolean;
  sourceDurations: ReadonlyMap<string, number>;
  zoom: number;
  onZoom: (zoom: number) => void;
}) {
  const widthMs = Math.max(MIN_VISIBLE_MS, durationMs + TAIL_MS);
  const clips = timedClips(editor.document);
  const sourceOf = (clip: TimedClip): number | null => {
    const media =
      clip.track === VideoTrack.Main
        ? editor.document.main.find((item) => item.id === clip.id)?.mediaVersionId
        : editor.document.audio.find((item) => item.id === clip.id)?.mediaVersionId;
    return media === undefined ? null : (sourceDurations.get(media) ?? null);
  };

  return (
    <section aria-label="Linha do tempo" className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <h2 className="text-sm font-medium">Linha do tempo</h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Diminuir zoom"
            disabled={zoom <= VIDEO_LIMITS.minZoom}
            onClick={() => onZoom(Math.max(VIDEO_LIMITS.minZoom, zoom / ZOOM_FACTOR))}
          >
            <ZoomOut aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Aumentar zoom"
            disabled={zoom >= VIDEO_LIMITS.maxZoom}
            onClick={() => onZoom(Math.min(VIDEO_LIMITS.maxZoom, zoom * ZOOM_FACTOR))}
          >
            <ZoomIn aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="flex">
        <div className="w-28 shrink-0 border-r text-xs font-medium text-muted-foreground">
          <div className="h-6 border-b" />
          {TRACKS.map((track) => (
            <div key={track} className="flex h-12 items-center border-b px-2 last:border-b-0">
              {VIDEO_TRACK_LABEL[track]}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: widthMs * zoom }}>
            <Ruler widthMs={widthMs} zoom={zoom} onSeek={playback.seek} />
            {TRACKS.map((track) => (
              <div
                key={track}
                role="group"
                aria-label={`Faixa ${VIDEO_TRACK_LABEL[track]}`}
                className="relative h-12 border-b last:border-b-0"
              >
                {clips
                  .filter((clip) => clip.track === track)
                  .map((clip) => (
                    <VideoTimelineClip
                      key={clip.id}
                      clip={clip}
                      label={clipLabel(editor.document, clip)}
                      editor={editor}
                      zoom={zoom}
                      playheadMs={playback.clock.get}
                      sourceDurationMs={sourceOf(clip)}
                      editable={editable}
                    />
                  ))}
              </div>
            ))}
            <Playhead playback={playback} zoom={zoom} />
          </div>
        </div>
      </div>
    </section>
  );
}
