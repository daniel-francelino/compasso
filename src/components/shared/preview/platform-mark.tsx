import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import { Platform } from "@/lib/shared/enums";
import { cn } from "@/lib/shared/utils";

const platformFills: Record<Platform, string> = {
  [Platform.Instagram]: "bg-platform-instagram",
  [Platform.Facebook]: "bg-platform-facebook",
  [Platform.Linkedin]: "bg-platform-linkedin",
  [Platform.Tiktok]: "bg-ink",
  [Platform.Youtube]: "bg-platform-youtube",
  [Platform.X]: "bg-ink",
  [Platform.Pinterest]: "bg-platform-pinterest",
  [Platform.Threads]: "bg-ink-soft",
  [Platform.Email]: "bg-violet",
  [Platform.Blog]: "bg-cactus",
  [Platform.Other]: "bg-line-strong",
};

export function PlatformMark({
  platform,
  className,
  iconClassName,
}: {
  platform: Platform;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-ivory",
        platformFills[platform],
        className,
      )}
    >
      <PlatformIcon platform={platform} className={iconClassName ?? "size-1/2"} />
    </span>
  );
}
