import {
  InstagramVideoPlayer,
  type VideoVariant,
} from "@/components/shared/preview/instagram/instagram-video-player";
import { MediaSlide, type PreviewMedia } from "@/components/shared/preview/media-slide";
import { MediaKind } from "@/lib/shared/media/limits";

export function InstagramSlide({
  item,
  position,
  total,
  variant,
  paused,
  muted,
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
  const playable = item.kind === MediaKind.Video && item.unavailable !== true && item.url !== null;
  if (!playable) return <MediaSlide item={item} position={position} total={total} />;
  return (
    <InstagramVideoPlayer
      key={item.versionId}
      item={item}
      position={position}
      total={total}
      variant={variant}
      paused={paused}
      muted={muted}
      onProgress={onProgress}
      onEnded={onEnded}
    />
  );
}
