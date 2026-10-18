import { ChevronLeft, ChevronRight, FileText, ImageOff } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Button } from "@/components/shared/ui/button";
import { ContentFormat, Platform } from "@/lib/shared/enums";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { MediaKind } from "@/lib/shared/media/limits";
import { platformDescriptors } from "@/lib/shared/preview/platforms";

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
  showCounter = false,
}: {
  platform: Platform;
  profileName: string;
  format: ContentFormat;
  caption: string;
  callToAction: string | null;
  media: PreviewMedia[];
  showCounter?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const descriptor = platformDescriptors[platform];
  const current = media[Math.min(index, Math.max(media.length - 1, 0))];
  const visible = descriptor.visibleCaption;
  const truncated = visible !== null && !expanded && caption.length > visible;
  const text = truncated ? `${caption.slice(0, visible)}…` : caption;
  const overLimit = descriptor.captionLimit !== null && caption.length > descriptor.captionLimit;

  return (
    <SectionCard
      as="figure"
      padding="none"
      className="mx-auto w-full max-w-sm overflow-hidden"
      aria-label={`Pré-visualização no ${platformLabels[platform]}`}
    >
      <figcaption className="flex items-center gap-2 border-b border-border p-3">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
        >
          {profileName.replace("@", "").slice(0, 1).toUpperCase()}
        </span>
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
      <div className="space-y-2 p-3 text-sm">
        {caption === "" ? (
          <p className="text-muted-foreground">Sem legenda.</p>
        ) : (
          <p className="whitespace-pre-wrap break-words">
            {text}
            {truncated ? (
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
