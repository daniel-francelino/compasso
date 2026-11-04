import type { MouseEvent, ReactNode } from "react";
import { InstagramCaption } from "@/components/shared/preview/instagram/instagram-caption";
import { InstagramFeedMedia } from "@/components/shared/preview/instagram/instagram-feed-media";
import { InstagramImmersiveFrame } from "@/components/shared/preview/instagram/instagram-immersive-frame";
import { InstagramPostHeader } from "@/components/shared/preview/instagram/instagram-post-header";
import type { PreviewMedia } from "@/components/shared/preview/media-slide";
import { ContentFormat } from "@/lib/shared/enums";

const INTERACTIVE = "button, a, input, textarea, select, video, audio, [role=tab], [role=button]";

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
  const immersive = format === ContentFormat.Reel || format === ContentFormat.Story;
  const hasCaption = caption.trim() !== "";

  function openFromMedia(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest(INTERACTIVE) !== null) return;
    onOpenMedia?.();
  }

  return (
    <div className="overflow-hidden">
      <InstagramPostHeader
        profileName={profileName}
        brandLogoUrl={brandLogoUrl}
        subtitle={subtitle}
        ring={immersive}
      />
      <div
        className={onOpenMedia ? "cursor-pointer" : undefined}
        onClick={onOpenMedia ? openFromMedia : undefined}
      >
        {immersive ? (
          <InstagramImmersiveFrame
            format={format}
            media={media}
            caption={caption}
            profileName={profileName}
            brandLogoUrl={brandLogoUrl}
          />
        ) : (
          <InstagramFeedMedia
            format={format}
            media={media}
            profileName={profileName}
            brandLogoUrl={brandLogoUrl}
          />
        )}
      </div>
      {actions}
      <div className="space-y-1 pb-2">
        {format === ContentFormat.Story && hasCaption ? (
          <p className="px-3 text-xs text-muted-foreground">Texto da publicação</p>
        ) : null}
        <InstagramCaption profileName={profileName} caption={caption} />
        {callToAction ? <p className="px-3 text-xs text-muted-foreground">{callToAction}</p> : null}
      </div>
      {footer}
    </div>
  );
}
