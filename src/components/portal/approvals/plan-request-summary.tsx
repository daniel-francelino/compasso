import { CalendarClock } from "lucide-react";
import { formatIcons } from "@/components/shared/content/format-icons";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
import { contentFormatLabels, contentObjectiveLabels, platformLabels } from "@/lib/shared/labels";

const DEFAULT_ZONE = "America/Sao_Paulo";

function FormatIcon({ format }: { format: ContentFormat }) {
  const Icon = formatIcons[format];
  return <Icon className="size-4" aria-hidden="true" />;
}

export function PlanRequestSummary({ request }: { request: PortalRequest }) {
  return (
    <div className="space-y-3">
      {request.objectiveKind ? (
        <p className="text-sm">
          <span className="font-medium">Objetivo:</span>{" "}
          {contentObjectiveLabels[request.objectiveKind]}
        </p>
      ) : null}
      {request.planSummary ? (
        <p className="whitespace-pre-wrap break-words text-sm">{request.planSummary}</p>
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
    </div>
  );
}
