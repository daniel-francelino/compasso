import { FileText } from "lucide-react";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useMediaRetry } from "@/hooks/shared/use-media-retry";
import { MediaKind } from "@/lib/shared/media/limits";

export type PreviewMedia = {
  versionId: string;
  kind: MediaKind | null;
  altText: string | null;
  url: string | null;
  unavailable?: boolean | undefined;
  refresh?: (() => Promise<Record<string, string> | undefined>) | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
};

export function UnavailableSlide() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <FileText className="size-8" aria-hidden="true" />
      <span className="text-xs">Prévia indisponível</span>
    </div>
  );
}

function ImageSlide({
  item,
  position,
  total,
}: {
  item: PreviewMedia;
  position: number;
  total: number;
}) {
  const retry = useMediaRetry(item);
  if (retry.failed || item.url === null) return <UnavailableSlide />;
  return (
    <img
      src={item.url}
      alt={item.altText ?? `Imagem ${position} de ${total}`}
      className="size-full object-cover"
      decoding="async"
      onError={retry.onError}
      onLoad={retry.onLoad}
    />
  );
}

function VideoSlide({
  item,
  position,
  total,
}: {
  item: PreviewMedia;
  position: number;
  total: number;
}) {
  const retry = useMediaRetry(item);
  if (retry.failed || item.url === null) return <UnavailableSlide />;
  return (
    <video
      src={item.url}
      controls
      preload="metadata"
      className="size-full object-contain"
      aria-label={item.altText ?? `Vídeo ${position} de ${total}`}
      onError={retry.onError}
      onLoadedData={retry.onLoad}
    />
  );
}

export function MediaSlide({
  item,
  position,
  total,
}: {
  item: PreviewMedia;
  position: number;
  total: number;
}) {
  if (item.unavailable === true) return <UnavailableSlide />;
  if (item.url === null) {
    return (
      <div className="size-full" role="status" aria-label="Carregando arquivo">
        <Skeleton className="size-full rounded-none" />
      </div>
    );
  }
  if (item.kind === MediaKind.Video)
    return <VideoSlide item={item} position={position} total={total} />;
  if (item.kind === MediaKind.Document) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <FileText className="size-8" aria-hidden="true" />
        <span className="text-xs">Documento anexado</span>
      </div>
    );
  }
  if (item.kind === MediaKind.Image)
    return <ImageSlide item={item} position={position} total={total} />;
  return <UnavailableSlide />;
}
