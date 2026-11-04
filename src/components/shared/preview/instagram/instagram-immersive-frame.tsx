import { Bookmark, Clapperboard, Ellipsis, Heart, Music2, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { InstagramMediaFallback } from "@/components/shared/preview/instagram/instagram-media-fallback";
import { MediaSlide, type PreviewMedia } from "@/components/shared/preview/media-slide";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/ui/avatar";
import { Button } from "@/components/shared/ui/button";
import { ContentFormat, Platform } from "@/lib/shared/enums";
import {
  INSTAGRAM_CAROUSEL_MAX_ITEMS,
  INSTAGRAM_REEL_MAX_REM,
  INSTAGRAM_STORY_MAX_REM,
  instagramSafeZones,
} from "@/lib/shared/preview/instagram";
import { previewFrameRatio } from "@/lib/shared/preview/platforms";
import { cn } from "@/lib/shared/utils";

const railIcons = [Heart, MessageCircle, Send, Bookmark, Ellipsis];
const zoneClass = "pointer-events-none absolute border border-dashed border-ivory bg-ink/25";

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
}: {
  format: ContentFormat;
  media: PreviewMedia[];
  caption: string;
  profileName: string;
  brandLogoUrl: string | null | undefined;
}) {
  const [index, setIndex] = useState(0);
  const [zones, setZones] = useState(false);
  const story = format === ContentFormat.Story;
  const items = media.slice(0, INSTAGRAM_CAROUSEL_MAX_ITEMS);
  const last = items.length - 1;
  const current = items[Math.min(index, Math.max(last, 0))];
  const many = items.length > 1;
  const name = profileName.replace(/^@/, "");
  const maxRem = story ? INSTAGRAM_STORY_MAX_REM : INSTAGRAM_REEL_MAX_REM;
  const move = (delta: number) => setIndex((value) => Math.min(last, Math.max(0, value + delta)));

  return (
    <div className="space-y-2 pb-2">
      <div
        className="relative mx-auto w-full overflow-hidden rounded-2xl bg-muted"
        style={{
          maxWidth: `${maxRem}rem`,
          aspectRatio: previewFrameRatio(Platform.Instagram, format, undefined),
        }}
      >
        {current === undefined ? (
          <InstagramMediaFallback profileName={profileName} brandLogoUrl={brandLogoUrl} />
        ) : (
          <MediaSlide item={current} position={index + 1} total={items.length} />
        )}
        {story ? (
          <div className="pointer-events-none absolute inset-x-2 top-2 space-y-2">
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: Math.max(items.length, 1) }, (_, position) => (
                <span
                  key={position}
                  className={cn(
                    "h-0.5 flex-1 rounded-full",
                    position <= index ? "bg-ivory" : "bg-ivory/40",
                  )}
                />
              ))}
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
              <span className="truncate text-xs font-semibold text-ivory">{name}</span>
            </div>
            <span className="sr-only" aria-live="polite">
              Arquivo {index + 1} de {Math.max(items.length, 1)}
            </span>
          </div>
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
              <span className="block truncate text-sm font-semibold">{name}</span>
              <span className="line-clamp-2 block text-xs">{caption}</span>
              <span className="flex items-center gap-1 text-xs">
                <Music2 className="size-3" />
                Áudio original · {name}
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
        {story ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 bottom-3 rounded-full border border-ivory/70 px-3 py-2 text-xs text-ivory"
          >
            Enviar mensagem
          </span>
        ) : null}
        {many && story ? (
          <>
            <button
              type="button"
              className="absolute inset-y-16 left-0 w-1/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Arquivo anterior"
              disabled={index === 0}
              onClick={() => move(-1)}
            />
            <button
              type="button"
              className="absolute inset-y-16 right-0 w-1/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Próximo arquivo"
              disabled={index === last}
              onClick={() => move(1)}
            />
          </>
        ) : null}
        {zones ? <SafeZones story={story} /> : null}
      </div>
      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          aria-pressed={zones}
          onClick={() => setZones((value) => !value)}
        >
          Mostrar áreas cobertas
        </Button>
      </div>
    </div>
  );
}
