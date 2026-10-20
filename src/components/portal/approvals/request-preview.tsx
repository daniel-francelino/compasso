import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import type { PortalChannel, PortalRequest } from "@/lib/portal/approvals/types";
import { getPortalBrand } from "@/lib/portal/approvals/portal.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { mediaUnavailable } from "@/lib/shared/preview/media-urls";
import { kindOfMime } from "@/lib/shared/media/limits";

const DEFAULT_ZONE = "America/Sao_Paulo";

export function RequestPreview({
  request,
  brandId,
  urls,
}: {
  request: PortalRequest;
  brandId: string;
  urls: Record<string, string> | undefined;
}) {
  const brand = useQuery({
    queryKey: QueryKey.Portal.brand(brandId),
    queryFn: async () => unwrapResult(await getPortalBrand({ data: { brandId } })).brand,
  });
  const [active, setActive] = useState(request.channels[0]?.rowId ?? "");
  const tabLabel = (channel: PortalChannel) =>
    `${platformLabels[channel.platform as Platform]} · ${contentFormatLabels[channel.format as ContentFormat]}`;
  return (
    <Tabs value={active} onValueChange={setActive} className="mx-auto w-full min-w-0 max-w-sm">
      {request.channels.length > 1 ? (
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          {request.channels.map((channel) => (
            <TabsTrigger key={channel.rowId} value={channel.rowId}>
              {tabLabel(channel)}
            </TabsTrigger>
          ))}
        </TabsList>
      ) : null}
      {request.channels.map((channel) => {
        const platform = channel.platform as Platform;
        const format = channel.format as ContentFormat;
        const zone = channel.plannedTimezone ?? request.brandTimezone ?? DEFAULT_ZONE;
        return (
          <TabsContent key={channel.rowId} value={channel.rowId} className="min-w-0 space-y-2">
            <p className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
              {channel.plannedAt
                ? `Publicação: ${formatInZone(channel.plannedAt, zone)}`
                : "Publicação sem data definida"}
              {channel.plannedAt ? (
                <InfoTip label={`Fuso horário: ${zone}`}>Fuso horário: {zone}</InfoTip>
              ) : null}
            </p>
            <ChannelPreview
              platform={platform}
              profileName={channel.profileName}
              brandLogoUrl={brand.data?.logoUrl ?? null}
              format={format}
              caption={channel.caption ?? ""}
              callToAction={null}
              compact
              media={request.media.map((item) => ({
                versionId: item.versionId,
                kind: kindOfMime(item.mimeType),
                altText: item.altText,
                width: item.width,
                height: item.height,
                url: urls?.[item.versionId] ?? null,
                unavailable: mediaUnavailable(urls, item.versionId),
              }))}
            />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
