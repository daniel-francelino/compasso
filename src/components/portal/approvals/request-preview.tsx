import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { getPortalBrand } from "@/lib/portal/approvals/portal.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
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
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-2xl gap-4 sm:grid-cols-2">
      {request.channels.map((channel) => {
        const platform = channel.platform as Platform;
        const format = channel.format as ContentFormat;
        const zone = channel.plannedTimezone ?? request.brandTimezone ?? DEFAULT_ZONE;
        return (
          <div key={channel.rowId} className="min-w-0 space-y-2">
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
                url: urls?.[item.versionId] ?? null,
              }))}
            />
          </div>
        );
      })}
    </div>
  );
}
