import { ChevronLeft, ChevronRight, FileText, ImageOff } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/ui/avatar";
import { Button } from "@/components/shared/ui/button";
import { ContentFormat, Platform } from "@/lib/shared/enums";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { MediaKind } from "@/lib/shared/media/limits";
import { platformDescriptors } from "@/lib/shared/preview/platforms";
import { cn } from "@/lib/shared/utils";

export type PreviewMedia = {
  versionId: string;
  kind: MediaKind | null;
  altText: string | null;
  url: string | null;
};

const TALL_FORMATS: readonly ContentFormat[] = [ContentFormat.Story, ContentFormat.Reel];

const aspectRatio = (platform: Platform, format: ContentFormat): string => {
  if (TALL_FORMATS.includes(format)) return "9 / 16";
  if (format === ContentFormat.Video) return "16 / 9";
  if (platform === Platform.Instagram) return "4 / 5";
  if (platform === Platform.Linkedin || platform === Platform.Facebook) return "1.91 / 1";
  return "1 / 1";
};

function Slide({ item, position, total }: { item: PreviewMedia; position: number; total: number }) {
  if (item.url === null) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <ImageOff className="size-8" aria-hidden="true" />
        <span className="text-xs">Carregando arquivo…</span>
      </div>
    );
  }
  if (item.kind === MediaKind.Video) {
    return (
      <video
        src={item.url}
        controls
        preload="metadata"
        className="size-full object-contain"
        aria-label={item.altText ?? `Vídeo ${position} de ${total}`}
      />
    );
  }
  if (item.kind === MediaKind.Document) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <FileText className="size-8" aria-hidden="true" />
        <span className="text-xs">Documento anexado</span>
      </div>
    );
  }
  return (
    <img
      src={item.url}
      alt={item.altText ?? `Imagem ${position} de ${total}`}
      className="size-full object-cover"
    />
  );
}

export function ChannelPreview({
  platform,
  profileName,
  format,
  caption,
  callToAction,
  media,
  brandLogoUrl,
  showCounter = false,
  compact = false,
}: {
  platform: Platform;
  profileName: string;
  format: ContentFormat;
  caption: string;
  callToAction: string | null;
  media: PreviewMedia[];
  brandLogoUrl?: string | null;
  showCounter?: boolean;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const descriptor = platformDescriptors[platform];
  const current = media[Math.min(index, Math.max(media.length - 1, 0))];
  const visible = descriptor.visibleCaption;
  const truncated = visible !== null && !expanded && caption.length > visible;
  const text = truncated ? `${caption.slice(0, visible)}…` : caption;
  const tall = TALL_FORMATS.includes(format);
  const width = compact ? (tall ? "max-w-44" : "max-w-64") : "max-w-sm";
  const overLimit = descriptor.captionLimit !== null && caption.length > descriptor.captionLimit;

  return (
    <SectionCard
      as="figure"
      padding="none"
      className={cn("mx-auto w-full overflow-hidden", width)}
      aria-label={`Pré-visualização no ${platformLabels[platform]}`}
    >
      <figcaption
        className={cn("flex items-center gap-2 border-b border-border", compact ? "p-2" : "p-3")}
      >
        <Avatar className={cn("shrink-0", compact ? "size-6" : "size-8")}>
          {brandLogoUrl ? (
            <AvatarImage src={brandLogoUrl} alt="" className="object-contain" />
          ) : null}
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            {profileName.replace("@", "").slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{profileName}</span>
          <span className="block text-xs text-muted-foreground">
            {platformLabels[platform]} · {contentFormatLabels[format]}
          </span>
        </span>
      </figcaption>
      {media.length > 0 && current !== undefined ? (
        <div className="relative bg-muted" style={{ aspectRatio: aspectRatio(platform, format) }}>
          <Slide item={current} position={index + 1} total={media.length} />
          {media.length > 1 ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 size-11 -translate-y-1/2"
                aria-label="Arquivo anterior"
                disabled={index === 0}
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 size-11 -translate-y-1/2"
                aria-label="Próximo arquivo"
                disabled={index === media.length - 1}
                onClick={() => setIndex((value) => Math.min(media.length - 1, value + 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
              <span
                className="absolute bottom-2 right-2 rounded-full bg-surface px-2 py-0.5 text-xs"
                aria-live="polite"
              >
                {index + 1} / {media.length}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
      <div className={cn("space-y-2 text-sm", compact ? "p-2 text-xs" : "p-3")}>
        {caption === "" ? (
          <p className="text-muted-foreground">-</p>
        ) : (
          <p className={cn("whitespace-pre-wrap break-words", compact && "line-clamp-2")}>
            {text}
            {truncated && !compact ? (
              <button
                type="button"
                className="ml-1 text-muted-foreground underline underline-offset-2"
                onClick={() => setExpanded(true)}
              >
                ver mais
              </button>
            ) : null}
          </p>
        )}
        {callToAction ? <p className="font-medium">{callToAction}</p> : null}
        {showCounter && descriptor.captionLimit !== null ? (
          <p
            className={overLimit ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
            aria-live="polite"
          >
            {caption.length}/{descriptor.captionLimit} caracteres
            {overLimit ? " — acima do limite da plataforma" : ""}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
