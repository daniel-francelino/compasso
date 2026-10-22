import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import type { Platform } from "@/lib/shared/enums";
import { platformLabels } from "@/lib/shared/labels";

const MAX_VISIBLE = 4;

export function ChannelLogos({
  channels,
}: {
  channels: { platform: Platform; profileName: string }[];
}) {
  if (channels.length === 0) return <span className="text-muted-foreground">—</span>;
  const visible = channels.slice(0, MAX_VISIBLE);
  const rest = channels.length - visible.length;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      role="img"
      aria-label={channels
        .map((channel) => `${platformLabels[channel.platform]} ${channel.profileName}`)
        .join(", ")}
    >
      {visible.map((channel, index) => (
        <span
          key={`${channel.platform}-${channel.profileName}-${index}`}
          className="inline-flex"
          title={`${platformLabels[channel.platform]} · ${channel.profileName}`}
        >
          <PlatformMark platform={channel.platform} className="size-6" iconClassName="size-3.5" />
        </span>
      ))}
      {rest > 0 ? <span className="text-xs text-muted-foreground">+{rest}</span> : null}
    </span>
  );
}
