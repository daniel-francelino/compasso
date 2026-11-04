import { CalendarClock } from "lucide-react";
import { RichTextView } from "@/components/shared/admin/rich-text-view";
import { formatIcons } from "@/components/shared/content/format-icons";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { MediaKind, kindOfMime } from "@/lib/shared/media/limits";

const DEFAULT_ZONE = "America/Sao_Paulo";

function FormatIcon({ format }: { format: ContentFormat }) {
  const Icon = formatIcons[format];
  return <Icon className="size-4" aria-hidden="true" />;
}

export function PlanRequestSummary({
  request,
  urls,
}: {
  request: PortalRequest;
  urls?: Record<string, string> | undefined;
}) {
  const references = request.media.filter((item) => kindOfMime(item.mimeType) === MediaKind.Image);
  return (
    <div className="space-y-3">
      {request.planSummary ? (
        <div className="text-sm">
          <RichTextView doc={request.planSummary} />
        </div>
      ) : null}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {request.channels.map((channel) => {
          const zone = channel.plannedTimezone ?? request.brandTimezone ?? DEFAULT_ZONE;
          return (
            <li
              key={channel.rowId}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
            >
              <span className="min-w-0 font-medium text-foreground">
                {platformLabels[channel.platform as Platform]} · {channel.profileName}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <FormatIcon format={channel.format as ContentFormat} />
                {contentFormatLabels[channel.format as ContentFormat]}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarClock className="size-4" aria-hidden="true" />
                {channel.plannedAt ? formatInZone(channel.plannedAt, zone) : "Sem data definida"}
              </span>
            </li>
          );
        })}
      </ul>
      {references.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Arquivos de referência ({references.length})
          </p>
          <ul className="flex flex-wrap gap-2">
            {references.map((item, position) => {
              const url = urls?.[item.versionId];
              return (
                <li
                  key={item.versionId}
                  className="size-20 overflow-hidden rounded-lg border border-border bg-muted"
                >
                  {url ? (
                    <img
                      src={url}
                      alt={item.altText ?? `Arquivo de referência ${position + 1}`}
                      className="size-full object-cover"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
