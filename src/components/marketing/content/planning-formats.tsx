import { RowFormatField } from "@/components/marketing/content/row-format-field";
import { PlatformMark } from "@/components/shared/preview/platform-mark";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import { platformLabels } from "@/lib/shared/labels";

export function PlanningFormats({
  draft,
  channels,
  disabled,
  errors,
}: {
  draft: ContentDraft;
  channels: ChannelRow[];
  disabled: boolean;
  errors: Record<string, string>;
}) {
  const rows = draft.values.rows;
  if (rows.length === 0) return null;
  return (
    <ul className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2" aria-label="Formatos">
      {rows.map((row, index) => {
        const channel = channels.find((candidate) => candidate.id === row.channelId);
        return (
          <li key={row.key} className="flex items-end gap-3">
            {channel ? <PlatformMark platform={channel.platform} className="mb-1 size-8" /> : null}
            <div className="min-w-0 flex-1">
              <RowFormatField
                id={`plan-format-${row.key}`}
                label={channel ? `Formato · ${platformLabels[channel.platform]}` : "Formato"}
                platform={channel?.platform}
                value={row.format}
                disabled={disabled || row.published}
                error={errors[`channels.${index}.format`]}
                onChange={(format) =>
                  draft.set(
                    "rows",
                    rows.map((entry) => (entry.key === row.key ? { ...entry, format } : entry)),
                  )
                }
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
