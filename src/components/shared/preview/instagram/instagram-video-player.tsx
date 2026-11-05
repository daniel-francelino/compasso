import { Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UnavailableSlide, type PreviewMedia } from "@/components/shared/preview/media-slide";
import { Button } from "@/components/shared/ui/button";
import { useInView } from "@/hooks/shared/use-in-view";
import { usePrefersReducedMotion } from "@/hooks/shared/use-prefers-reduced-motion";
import { SEEK_STEPS, VIDEO_VISIBLE_THRESHOLD } from "@/lib/shared/preview/instagram";
import { cn } from "@/lib/shared/utils";
import type { ValueOf } from "@/lib/shared/utils";

export const VideoVariant = {
  Feed: "feed",
  Reel: "reel",
  Story: "story",
} as const;
export type VideoVariant = ValueOf<typeof VideoVariant>;

const Intent = { Auto: "auto", Play: "play", Pause: "pause" } as const;
type Intent = ValueOf<typeof Intent>;

const mutePosition: Record<VideoVariant, string> = {
  [VideoVariant.Feed]: "bottom-3 right-3",
  [VideoVariant.Reel]: "right-3 top-3",
  [VideoVariant.Story]: "hidden",
};

export function InstagramVideoPlayer({
  item,
  position,
  total,
  variant,
  paused: pausedProp,
  muted: mutedProp,
  onProgress,
  onEnded,
}: {
  item: PreviewMedia;
  position: number;
  total: number;
  variant: VideoVariant;
  paused?: boolean | undefined;
  muted?: boolean | undefined;
  onProgress?: ((fraction: number) => void) | undefined;
  onEnded?: (() => void) | undefined;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref: frameRef, inView } = useInView<HTMLDivElement>(VIDEO_VISIBLE_THRESHOLD);
  const reduced = usePrefersReducedMotion();
  const [intent, setIntent] = useState<Intent>(Intent.Auto);
  const [internalMuted, setInternalMuted] = useState(true);
  const [fraction, setFraction] = useState(0);
  const [failed, setFailed] = useState(false);
  const story = variant === VideoVariant.Story;
  const muted = mutedProp ?? internalMuted;
  const selfPlaying = inView && intent !== Intent.Pause && (intent === Intent.Play || !reduced);
  const playing = pausedProp === undefined ? selfPlaying : !pausedProp;
  const showPlay = !story && !playing && (intent !== Intent.Auto || reduced);

  useEffect(() => {
    const video = videoRef.current;
    if (video !== null) video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;
    if (!playing) {
      video.pause();
      return;
    }
    void video.play().catch(() => setIntent(Intent.Pause));
  }, [playing]);

  if (failed || item.url === null) return <UnavailableSlide />;

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (video === null || !(video.duration > 0)) return;
    const next = video.currentTime / video.duration;
    setFraction(next);
    onProgress?.(next);
  };
  const seek = (value: number) => {
    const video = videoRef.current;
    if (video === null || !(video.duration > 0)) return;
    video.currentTime = (value / SEEK_STEPS) * video.duration;
    setFraction(value / SEEK_STEPS);
  };

  return (
    <div ref={frameRef} className="relative size-full bg-muted">
      <video
        ref={videoRef}
        src={item.url}
        loop={!story}
        muted
        playsInline
        preload="metadata"
        className="size-full object-cover"
        aria-label={item.altText ?? `Vídeo ${position} de ${total}`}
        onError={() => setFailed(true)}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />
      {story ? null : (
        <button
          type="button"
          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}
          onClick={() => setIntent(playing ? Intent.Pause : Intent.Play)}
        />
      )}
      {showPlay ? (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink/60 text-ivory"
          aria-hidden="true"
        >
          <Play className="size-7 fill-current" />
        </span>
      ) : null}
      {story ? null : (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={cn(
            "absolute size-9 rounded-full bg-ink/60 text-ivory hover:bg-ink/80 [&_svg]:size-5",
            mutePosition[variant],
          )}
          aria-label={muted ? "Ativar som" : "Silenciar"}
          aria-pressed={!muted}
          onClick={() => setInternalMuted(!muted)}
        >
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </Button>
      )}
      {variant === VideoVariant.Reel ? (
        <div className="absolute inset-x-0 bottom-0 h-6 focus-within:ring-2 focus-within:ring-ring">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-ivory/30" aria-hidden="true">
            <div className="h-full bg-ivory" style={{ width: `${fraction * 100}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={SEEK_STEPS}
            value={Math.round(fraction * SEEK_STEPS)}
            aria-label="Posição do vídeo"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            onChange={(event) => seek(Number(event.target.value))}
          />
        </div>
      ) : null}
    </div>
  );
}
