import { useState } from "react";
import type { ReactNode } from "react";
import { InstagramCaption } from "@/components/shared/preview/instagram/instagram-caption";
import { InstagramFeedMedia } from "@/components/shared/preview/instagram/instagram-feed-media";
import { InstagramImmersiveFrame } from "@/components/shared/preview/instagram/instagram-immersive-frame";
import { InstagramPostHeader } from "@/components/shared/preview/instagram/instagram-post-header";
import type { PreviewMedia } from "@/components/shared/preview/media-slide";
import { OpenOnClick } from "@/components/shared/preview/open-on-click";
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
  onOpenMedia,
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
  onOpenMedia?: () => void;
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
          onOpen: onOpenMedia,
          safeZones: immersive ? { checked: safeZones, onCheckedChange: setSafeZones } : undefined,
        }}
      />
      <OpenOnClick onOpen={onOpenMedia}>
        {immersive ? (
          <InstagramImmersiveFrame
            format={format}
            media={media}
            caption={shownCaption}
            profileName={profileName}
            brandLogoUrl={brandLogoUrl}
            showSafeZones={safeZones}
          />
        ) : (
          <InstagramFeedMedia
            format={format}
            media={media}
            profileName={profileName}
            brandLogoUrl={brandLogoUrl}
          />
        )}
      </OpenOnClick>
      {actions}
      <div className="space-y-1 pb-2">
        <InstagramCaption profileName={profileName} caption={shownCaption} />
        {callToAction && !story ? (
          <p className="px-3 text-xs text-muted-foreground">{callToAction}</p>
        ) : null}
      </div>
      {footer}
    </div>
  );
}
