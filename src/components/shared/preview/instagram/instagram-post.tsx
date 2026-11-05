import { useState } from "react";
import type { ReactNode } from "react";
import { InstagramCaption } from "@/components/shared/preview/instagram/instagram-caption";
import { InstagramMedia } from "@/components/shared/preview/instagram/instagram-media";
import { InstagramPostHeader } from "@/components/shared/preview/instagram/instagram-post-header";
import type { PreviewMedia } from "@/components/shared/preview/media-slide";
import { ContentFormat } from "@/lib/shared/enums";

export function InstagramPost({
  format,
  profileName,
  brandLogoUrl,
  subtitle,
  media,
  caption,
  callToAction,
  actions,
  footer,
  onOpenDetails,
}: {
  format: ContentFormat;
  profileName: string;
  brandLogoUrl: string | null | undefined;
  subtitle?: ReactNode;
  media: PreviewMedia[];
  caption: string;
  callToAction: string | null;
  actions?: ReactNode;
  footer?: ReactNode;
  onOpenDetails?: () => void;
}) {
  const [safeZones, setSafeZones] = useState(false);
  const story = format === ContentFormat.Story;
  const immersive = story || format === ContentFormat.Reel;
  const shownCaption = story ? "" : caption;

  return (
    <div className="overflow-hidden">
      <InstagramPostHeader
        profileName={profileName}
        brandLogoUrl={brandLogoUrl}
        subtitle={subtitle}
        ring={immersive}
        menu={{
          onOpen: onOpenDetails,
          safeZones: immersive ? { checked: safeZones, onCheckedChange: setSafeZones } : undefined,
        }}
      />
      <InstagramMedia
        format={format}
        media={media}
        caption={caption}
        profileName={profileName}
        brandLogoUrl={brandLogoUrl}
        showSafeZones={safeZones}
      />
      {actions}
      <div className="space-y-1 pb-2">
        <InstagramCaption caption={shownCaption} />
        {callToAction && !story ? (
          <p className="px-3 text-xs text-muted-foreground">{callToAction}</p>
        ) : null}
      </div>
      {footer}
    </div>
  );
}
