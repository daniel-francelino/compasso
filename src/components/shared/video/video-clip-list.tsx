import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/shared/ui/button";
import type { VideoEditor } from "@/hooks/shared/video/use-video-editor";
import { cn } from "@/lib/shared/utils";
import { clipLabel } from "@/lib/shared/video/labels";
import { formatTimecode, sameRef, timedClips } from "@/lib/shared/video/timeline";
import { VIDEO_TRACK_LABEL, VideoTrack } from "@/lib/shared/video/types";

const TRACKS = Object.values(VideoTrack);

export function VideoClipList({
  editor,
  editable,
  onSeek,
}: {
  editor: VideoEditor;
  editable: boolean;
  onSeek: (ms: number) => void;
}) {
  const clips = timedClips(editor.document);
  if (clips.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum clipe ainda. Use os botões Clipe, Imagem, Texto e Música acima.
      </p>
    );
  }
  const mainCount = editor.document.main.length;
  return (
    <div className="space-y-4">
      {TRACKS.map((track) => {
        const items = clips.filter((clip) => clip.track === track);
        if (items.length === 0) return null;
        return (
          <section key={track} aria-label={VIDEO_TRACK_LABEL[track]} className="space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground uppercase">
              {VIDEO_TRACK_LABEL[track]}
            </h3>
            <ul className="space-y-1">
              {items.map((clip, index) => {
                const label = clipLabel(editor.document, clip);
                const selected = sameRef(editor.selected, clip);
                return (
                  <li key={clip.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={selected}
                      className={cn(
                        "min-h-11 min-w-0 flex-1 rounded-md border px-2 py-1 text-left text-sm",
                        selected ? "border-ring bg-accent" : "hover:bg-muted",
                      )}
                      onClick={() => {
                        editor.select({ track: clip.track, id: clip.id });
                        onSeek(clip.startMs);
                      }}
                    >
                      <span className="block truncate font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatTimecode(clip.startMs)} –{" "}
                        {formatTimecode(clip.startMs + clip.durationMs)}
                      </span>
                    </button>
                    {track === VideoTrack.Main && editable ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          aria-label={`Mover para a esquerda: ${label}`}
                          onClick={() => editor.reorder(clip.id, -1)}
                        >
                          <ArrowLeft aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === mainCount - 1}
                          aria-label={`Mover para a direita: ${label}`}
                          onClick={() => editor.reorder(clip.id, 1)}
                        >
                          <ArrowRight aria-hidden="true" />
                        </Button>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
