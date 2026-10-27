import { DateTimeField } from "@/components/shared/admin/date-time-field";
import { FieldGroup } from "@/components/shared/admin/field-group";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";

export function PlanScheduleFields({
  draft,
  channels,
  zone,
  disabled,
  errors,
}: {
  draft: ContentDraft;
  channels: ChannelRow[];
  zone: string;
  disabled: boolean;
  errors: Record<string, string>;
}) {
  const rows = draft.values.rows.filter((row) => !row.published);
  if (rows.length === 0) return null;

  const update = (key: string, plannedAt: string | null, plannedTimezone: string | null) =>
    draft.set(
      "rows",
      draft.values.rows.map((row) =>
        row.key === key ? { ...row, plannedAt, plannedTimezone } : row,
      ),
    );

  return (
    <FieldGroup legend="Programação das publicações" gap="sm">
      <ul className="space-y-3">
        {rows.map((row) => {
          const channel = channels.find((candidate) => candidate.id === row.channelId);
          const index = draft.values.rows.findIndex((entry) => entry.key === row.key);
          return (
            <li key={row.key} className="space-y-1.5 rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground">
                {channel ? `${platformLabels[channel.platform]} · ${channel.profileName}` : "Canal"}
                {` · ${contentFormatLabels[row.format]}`}
              </p>
              <DateTimeField
                id={`approve-planned-${row.key}`}
                label="Data"
                value={row.plannedAt}
                timeZone={row.plannedTimezone ?? zone}
                disabled={disabled}
                onValueChange={(value) =>
                  update(row.key, value, value === null ? null : (row.plannedTimezone ?? zone))
                }
                error={errors[`channels.${index}.plannedAt`]}
              />
            </li>
          );
        })}
      </ul>
    </FieldGroup>
  );
}
