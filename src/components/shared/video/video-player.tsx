import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/shared/ui/button";
import type { VideoPlayback } from "@/hooks/shared/video/use-video-playback";
import type { PageSize } from "@/lib/shared/design/types";
import { formatTimecode } from "@/lib/shared/video/timeline";

function TimeLabel({ playback, durationMs }: { playback: VideoPlayback; durationMs: number }) {
  const time = useSyncExternalStore(playback.clock.subscribe, playback.clock.get, () => 0);
  return (
    <span className="font-mono text-sm tabular-nums" aria-live="off">
      {formatTimecode(time)} / {formatTimecode(durationMs)}
    </span>
  );
}

export function VideoPlayer({
  playback,
  size,
  scale,
  durationMs,
  label,
}: {
  playback: VideoPlayback;
  size: PageSize;
  scale: number;
  durationMs: number;
  label: string;
}) {
  const width = Math.round(size.width * scale);
  const height = Math.round(size.height * scale);
  const empty = durationMs === 0;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="overflow-hidden rounded-md border shadow-sm" style={{ width, height }}>
        <canvas
          ref={playback.canvasRef}
          width={width}
          height={height}
          role="img"
          aria-label={label}
          className="block"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={empty}
          onClick={() => playback.step(-1)}
          aria-label="Quadro anterior"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon"
          disabled={empty}
          onClick={playback.toggle}
          aria-label={playback.playing ? "Pausar" : "Reproduzir"}
          aria-keyshortcuts="Space"
        >
          {playback.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={empty}
          onClick={() => playback.step(1)}
          aria-label="Próximo quadro"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <TimeLabel playback={playback} durationMs={durationMs} />
      </div>
      <div ref={playback.hostRef} hidden />
    </div>
  );
}
