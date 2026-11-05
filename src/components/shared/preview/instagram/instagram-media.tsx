import { InstagramFeedMedia } from "@/components/shared/preview/instagram/instagram-feed-media";
import { InstagramImmersiveFrame } from "@/components/shared/preview/instagram/instagram-immersive-frame";
import type { PreviewMedia } from "@/components/shared/preview/media-slide";
import { ContentFormat, Platform } from "@/lib/shared/enums";
import { DETAIL_SCREEN_PERCENT, ratioValue } from "@/lib/shared/preview/instagram";
import { previewFrameRatio } from "@/lib/shared/preview/platforms";

export function InstagramMedia({
  format,
  media,
  caption,
  profileName,
  brandLogoUrl,
  showSafeZones = false,
  fitScreen = false,
}: {
  format: ContentFormat;
  media: PreviewMedia[];
  caption: string;
  profileName: string;
  brandLogoUrl: string | null | undefined;
  showSafeZones?: boolean;
  fitScreen?: boolean;
}) {
  const immersive = format === ContentFormat.Story || format === ContentFormat.Reel;
  const ratio = ratioValue(
    previewFrameRatio(Platform.Instagram, format, immersive ? undefined : media[0]),
  );
  const width = `min(100%, calc(${DETAIL_SCREEN_PERCENT}dvh * ${ratio}))`;

  if (immersive) {
    return (
      <InstagramImmersiveFrame
        format={format}
        media={media}
        caption={caption}
        profileName={profileName}
        brandLogoUrl={brandLogoUrl}
        showSafeZones={showSafeZones}
        maxWidth={fitScreen ? width : undefined}
      />
    );
  }
  const feed = (
    <InstagramFeedMedia
      format={format}
      media={media}
      profileName={profileName}
      brandLogoUrl={brandLogoUrl}
    />
  );
  if (!fitScreen) return feed;
  return (
    <div className="mx-auto" style={{ width }}>
      {feed}
    </div>
  );
}
