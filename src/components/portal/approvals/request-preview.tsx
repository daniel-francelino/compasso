import { useState } from "react";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { kindOfMime } from "@/lib/shared/media/limits";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";

export function RequestPreview({
  request,
  urls,
}: {
  request: PortalRequest;
  urls: Record<string, string> | undefined;
}) {
  const [active, setActive] = useState(request.channels[0]?.rowId ?? "");
  const current =
    request.channels.find((channel) => channel.rowId === active) ?? request.channels[0];

  if (current === undefined) return null;

  const platform = current.platform as Platform;
  const format = current.format as ContentFormat;
  return (
    <div className="min-w-0 space-y-2">
      {request.channels.length > 1 ? (
        <Tabs value={current.rowId} onValueChange={setActive}>
          <TabsList className="h-auto max-w-full flex-wrap justify-start">
            {request.channels.map((channel) => (
              <TabsTrigger key={channel.rowId} value={channel.rowId}>
                <PlatformIcon platform={channel.platform as Platform} />
                {platformLabels[channel.platform as Platform]} ·{" "}
                {contentFormatLabels[channel.format as ContentFormat]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <ChannelPreview
        platform={platform}
        profileName={current.profileName}
        format={format}
        caption={current.caption ?? ""}
        callToAction={null}
        media={request.media.map((item) => ({
          versionId: item.versionId,
          kind: kindOfMime(item.mimeType),
          altText: item.altText,
          url: urls?.[item.versionId] ?? null,
        }))}
      />
    </div>
  );
}
