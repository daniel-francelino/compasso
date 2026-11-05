import {
  Bookmark,
  Clapperboard,
  Ellipsis,
  Heart,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { InstagramMediaFallback } from "@/components/shared/preview/instagram/instagram-media-fallback";
import { InstagramSlide } from "@/components/shared/preview/instagram/instagram-slide";
import { VideoVariant } from "@/components/shared/preview/instagram/instagram-video-player";
import type { PreviewMedia } from "@/components/shared/preview/media-slide";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/ui/avatar";
import { Button } from "@/components/shared/ui/button";
import { useInView } from "@/hooks/shared/use-in-view";
import { usePrefersReducedMotion } from "@/hooks/shared/use-prefers-reduced-motion";
import { ContentFormat, Platform } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";
import {
  INSTAGRAM_CAROUSEL_MAX_ITEMS,
  INSTAGRAM_REEL_MAX_REM,
  INSTAGRAM_STORY_MAX_REM,
  VIDEO_VISIBLE_THRESHOLD,
  instagramSafeZones,
  instagramStory,
} from "@/lib/shared/preview/instagram";
import { nowMs } from "@/lib/shared/dates";
import { previewFrameRatio } from "@/lib/shared/preview/platforms";
import { cn } from "@/lib/shared/utils";

const railIcons = [Heart, MessageCircle, Send, Bookmark, Ellipsis];
const zoneClass = "pointer-events-none absolute border border-dashed border-ivory bg-ink/25";
const headerButton =
  "pointer-events-auto size-8 text-ivory hover:bg-ink/40 hover:text-ivory [&_svg]:size-5";

function SafeZones({ story }: { story: boolean }) {
  const { story: s, reel: r } = instagramSafeZones;
  if (story) {
    return (
      <>
        <span
          aria-hidden="true"
          className={cn(zoneClass, "inset-x-0 top-0")}
          style={{ height: `${s.topPercent}%` }}
        />
        <span
          aria-hidden="true"
          className={cn(zoneClass, "inset-x-0 bottom-0")}
          style={{ height: `${s.bottomPercent}%` }}
        />
      </>
    );
  }
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(zoneClass, "inset-x-0 bottom-0")}
        style={{ height: `${r.bottomPercent}%` }}
      />
      <span
        aria-hidden="true"
        className={cn(zoneClass, "inset-y-0 right-0")}
        style={{ width: `${r.rightPercent}%` }}
      />
    </>
  );
}

export function InstagramImmersiveFrame({
  format,
  media,
  caption,
  profileName,
  brandLogoUrl,
  showSafeZones,
}: {
  format: ContentFormat;
  media: PreviewMedia[];
  caption: string;
  profileName: string;
  brandLogoUrl: string | null | undefined;
  showSafeZones: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [holding, setHolding] = useState(false);
  const [muted, setMuted] = useState(true);
  const downAt = useRef<number | null>(null);
  const { ref: frameRef, inView } = useInView<HTMLDivElement>(VIDEO_VISIBLE_THRESHOLD);
  const reduced = usePrefersReducedMotion();
  const story = format === ContentFormat.Story;
  const items = media.slice(0, INSTAGRAM_CAROUSEL_MAX_ITEMS);
  const last = items.length - 1;
  const current = items[Math.min(index, Math.max(last, 0))];
  const isVideo = current?.kind === MediaKind.Video && current.unavailable !== true;
  const timed = story && current !== undefined && !isVideo;
  const stopped = userPaused ?? reduced;
  const paused = stopped || holding || !inView;
  const name = profileName.replace(/^@/, "");
  const maxRem = story ? INSTAGRAM_STORY_MAX_REM : INSTAGRAM_REEL_MAX_REM;

  useEffect(() => {
    if (!timed || paused) return;
    const step = instagramStory.tickMs / (instagramStory.imageSeconds * 1000);
    const timer = window.setInterval(
      () => setProgress((value) => Math.min(1, value + step)),
      instagramStory.tickMs,
    );
    return () => window.clearInterval(timer);
  }, [timed, paused]);

  useEffect(() => {
    if (!timed || progress < 1 || index >= last) return;
    setIndex(index + 1);
    setProgress(0);
  }, [timed, progress, index, last]);

  const go = (delta: number) => {
    const next = Math.min(last, Math.max(0, index + delta));
    setProgress(0);
    setIndex(next);
  };
  const press = () => {
    downAt.current = nowMs();
    setHolding(true);
  };
  const release = () => setHolding(false);
  const tap = (delta: number) => {
    const held = downAt.current !== null && nowMs() - downAt.current > instagramStory.holdPauseMs;
    downAt.current = null;
    if (!held) go(delta);
  };
  const zoneHandlers = {
    onPointerDown: press,
    onPointerUp: release,
    onPointerLeave: release,
    onPointerCancel: release,
  };
  const slide =
    current === undefined ? (
      <InstagramMediaFallback profileName={profileName} brandLogoUrl={brandLogoUrl} />
    ) : (
      <InstagramSlide
        item={current}
        position={index + 1}
        total={items.length}
        variant={story ? VideoVariant.Story : VideoVariant.Reel}
        paused={story ? paused : undefined}
        muted={story ? muted : undefined}
        onProgress={story ? setProgress : undefined}
        onEnded={story ? () => go(1) : undefined}
      />
    );

  return (
    <div className="pb-2">
      <div
        ref={frameRef}
        className="relative mx-auto w-full overflow-hidden rounded-2xl bg-muted"
        style={{
          maxWidth: `${maxRem}rem`,
          aspectRatio: previewFrameRatio(Platform.Instagram, format, undefined),
        }}
      >
        {slide}
        {story ? (
          <>
            <div className="pointer-events-none absolute inset-x-2 top-2 space-y-2">
              <div className="flex gap-1" aria-hidden="true">
                {Array.from({ length: Math.max(items.length, 1) }, (_, position) => {
                  const fill = position < index ? 1 : position === index ? progress : 0;
                  return (
                    <span
                      key={position}
                      className="h-0.5 flex-1 overflow-hidden rounded-full bg-ivory/40"
                    >
                      <span className="block h-full bg-ivory" style={{ width: `${fill * 100}%` }} />
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  {brandLogoUrl ? (
                    <AvatarImage src={brandLogoUrl} alt="" className="object-contain" />
                  ) : null}
                  <AvatarFallback className="bg-surface text-xs text-foreground">
                    {name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ivory">
                  {name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={headerButton}
                  aria-label={stopped ? "Reproduzir story" : "Pausar story"}
                  onClick={() => setUserPaused(!stopped)}
                >
                  {stopped ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                </Button>
                {isVideo ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={headerButton}
                    aria-label={muted ? "Ativar som" : "Silenciar"}
                    aria-pressed={!muted}
                    onClick={() => setMuted(!muted)}
                  >
                    {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
                  </Button>
                ) : null}
              </div>
              <span className="sr-only" aria-live="polite">
                Arquivo {index + 1} de {Math.max(items.length, 1)}
              </span>
            </div>
            {caption.trim() === "" ? null : (
              <p className="pointer-events-none absolute inset-x-3 bottom-16 truncate text-sm text-ivory drop-shadow">
                {caption}
              </p>
            )}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-3 text-ivory"
            >
              <span className="flex-1 rounded-full border border-ivory/70 px-3 py-2 text-xs">
                Enviar mensagem
              </span>
              <Heart className="size-6" />
              <Send className="size-6" />
            </div>
            <button
              type="button"
              className="absolute inset-y-16 left-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ width: `${instagramStory.backZonePercent}%` }}
              aria-label="Arquivo anterior"
              onClick={() => tap(-1)}
              {...zoneHandlers}
            />
            <button
              type="button"
              className="absolute inset-y-16 right-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ width: `${100 - instagramStory.backZonePercent}%` }}
              aria-label="Próximo arquivo"
              onClick={() => tap(1)}
              {...zoneHandlers}
            />
          </>
        ) : (
          <>
            <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 text-sm font-semibold text-ivory">
              <Clapperboard className="size-4" aria-hidden="true" />
              Reels
            </span>
            <div
              className="pointer-events-none absolute bottom-12 left-3 right-16 space-y-1 text-ivory"
              aria-hidden="true"
            >
              <span className="block truncate text-xs">{caption}</span>
              <span className="flex min-w-0 items-center gap-1 text-xs">
                <Music2 className="size-3 shrink-0" />
                <span className="truncate">Áudio original · {name}</span>
              </span>
            </div>
            <div
              className="pointer-events-none absolute bottom-24 right-2 flex flex-col items-center gap-4 text-ivory"
              aria-hidden="true"
            >
              {railIcons.map((Icon, position) => (
                <Icon key={position} className="size-6" />
              ))}
            </div>
          </>
        )}
        {showSafeZones ? <SafeZones story={story} /> : null}
      </div>
    </div>
  );
}
