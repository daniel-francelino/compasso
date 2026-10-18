import { PUBLIC_LARGE, PUBLIC_SMALL } from "@/lib/shared/content/media-urls";
import type { PublishedMedia } from "@/lib/shared/content/published";

export type ImageValue = { mediaVersionId: string | null; alt: string };

export function SiteImage({
  image,
  media,
  className,
  sizes = "(min-width: 768px) 50vw, 100vw",
}: {
  image: ImageValue | null;
  media: PublishedMedia;
  className?: string;
  sizes?: string;
}) {
  if (image === null || image.mediaVersionId === null) return null;
  const entry = media[image.mediaVersionId];
  if (entry === undefined) return null;
  return (
    <img
      src={entry.large}
      srcSet={`${entry.small} ${PUBLIC_SMALL}w, ${entry.large} ${PUBLIC_LARGE}w`}
      sizes={sizes}
      alt={image.alt}
      width={entry.width ?? undefined}
      height={entry.height ?? undefined}
      loading="lazy"
      className={className}
    />
  );
}
