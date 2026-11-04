import { ChevronLeft, ChevronRight, Clapperboard } from "lucide-react";
import { type KeyboardEvent, type TouchEvent, useRef, useState } from "react";
import { InstagramMediaFallback } from "@/components/shared/preview/instagram/instagram-media-fallback";
import { InstagramSlide } from "@/components/shared/preview/instagram/instagram-slide";
import { VideoVariant } from "@/components/shared/preview/instagram/instagram-video-player";
import type { PreviewMedia } from "@/components/shared/preview/media-slide";
import { Button } from "@/components/shared/ui/button";
import { ContentFormat, Platform } from "@/lib/shared/enums";
import { INSTAGRAM_CAROUSEL_MAX_ITEMS } from "@/lib/shared/preview/instagram";
import { previewFrameRatio } from "@/lib/shared/preview/platforms";
import { cn } from "@/lib/shared/utils";

const SWIPE_PX = 40;

export function InstagramFeedMedia({
  format,
  media,
  profileName,
  brandLogoUrl,
}: {
  format: ContentFormat;
  media: PreviewMedia[];
  profileName: string;
  brandLogoUrl: string | null | undefined;
}) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const items = media.slice(0, INSTAGRAM_CAROUSEL_MAX_ITEMS);
  const last = items.length - 1;
  const current = items[Math.min(index, Math.max(last, 0))];
  const many = items.length > 1;
  const move = (delta: number) => setIndex((value) => Math.min(last, Math.max(0, value + delta)));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") move(1);
    if (event.key === "ArrowLeft") move(-1);
  };
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStart.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const end = event.changedTouches[0]?.clientX;
    touchStart.current = null;
    if (start === null || end === undefined) return;
    if (Math.abs(end - start) < SWIPE_PX) return;
    move(end < start ? 1 : -1);
  };

  return (
    <div>
      <div
        role={many ? "group" : undefined}
        aria-roledescription={many ? "carrossel" : undefined}
        aria-label={many ? `Arquivo ${index + 1} de ${items.length}` : undefined}
        tabIndex={many ? 0 : undefined}
        onKeyDown={many ? onKeyDown : undefined}
        onTouchStart={many ? onTouchStart : undefined}
        onTouchEnd={many ? onTouchEnd : undefined}
        className="relative overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ aspectRatio: previewFrameRatio(Platform.Instagram, format, items[0]) }}
      >
        {current === undefined ? (
          <InstagramMediaFallback profileName={profileName} brandLogoUrl={brandLogoUrl} />
        ) : (
          <InstagramSlide
            item={current}
            position={index + 1}
            total={items.length}
            variant={VideoVariant.Feed}
          />
        )}
        {format === ContentFormat.Video && current !== undefined ? (
          <Clapperboard
            className="absolute right-3 top-3 size-5 text-ivory drop-shadow"
            aria-hidden="true"
          />
        ) : null}
        {many ? (
          <>
            <span
              className="absolute right-3 top-3 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-medium text-ivory"
              aria-hidden="true"
            >
              {index + 1}/{items.length}
            </span>
            {index > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 size-11 -translate-y-1/2"
                aria-label="Arquivo anterior"
                onClick={() => move(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
            ) : null}
            {index < last ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 size-11 -translate-y-1/2"
                aria-label="Próximo arquivo"
                onClick={() => move(1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      {many ? (
        <div
          className="flex items-center justify-center gap-1 pt-2"
          role="group"
          aria-label="Arquivos da publicação"
        >
          {items.map((item, itemIndex) => (
            <button
              key={item.versionId}
              type="button"
              className="flex size-4 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Exibir arquivo ${itemIndex + 1} de ${items.length}`}
              aria-pressed={index === itemIndex}
              onClick={() => setIndex(itemIndex)}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  index === itemIndex ? "bg-primary" : "bg-muted-foreground/50",
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
