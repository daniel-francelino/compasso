import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { getPortalBrand } from "@/lib/portal/approvals/portal.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
import { kindOfMime } from "@/lib/shared/media/limits";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";

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
  const current =
    request.channels.find((channel) => channel.rowId === active) ?? request.channels[0];

  if (current === undefined) return null;

  const platform = current.platform as Platform;
  const format = current.format as ContentFormat;
  const zone = current.plannedTimezone ?? request.brandTimezone ?? DEFAULT_ZONE;
  return (
    <div className="mx-auto w-full min-w-0 max-w-64 space-y-2">
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
      <p className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground">
        <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
        {current.plannedAt
          ? `Publicação: ${formatInZone(current.plannedAt, zone)}`
          : "Publicação sem data definida"}
      </p>
      <ChannelPreview
        platform={platform}
        profileName={current.profileName}
        brandLogoUrl={brand.data?.logoUrl ?? null}
        format={format}
        caption={current.caption ?? ""}
        callToAction={null}
        compact
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
