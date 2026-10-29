import { Check } from "lucide-react";
import { formatIcons } from "@/components/shared/content/format-icons";
import type { ContentDraft, DraftRow } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import type { ContentFormat } from "@/lib/shared/enums";
import { platformFormats } from "@/lib/shared/editorial/editorial";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { cn } from "@/lib/shared/utils";

const MAX_CHANNEL_ROWS = 20;

const newRow = (draft: ContentDraft, source: DraftRow, format: ContentFormat): DraftRow => ({
  key: draft.nextKey(),
  id: undefined,
  channelId: source.channelId,
  format,
  caption: "",
  plannedAt: source.plannedAt,
  plannedTimezone: source.plannedTimezone,
  published: false,
  version: undefined,
});

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
  const channelIds = [...new Set(rows.map((row) => row.channelId))];
  if (channelIds.length === 0) return null;

  return (
    <div className="space-y-4" aria-label="Formatos por canal">
      {channelIds.map((channelId) => {
        const channel = channels.find((candidate) => candidate.id === channelId);
        if (channel === undefined) return null;
        const channelRows = rows.filter((row) => row.channelId === channelId);
        const selectedFormats = new Set(channelRows.map((row) => row.format));
        const lockedFormats = new Set(
          channelRows.filter((row) => row.published).map((row) => row.format),
        );

        const toggleFormat = (format: ContentFormat) => {
          const isSelected = selectedFormats.has(format);
          if (disabled || (isSelected && lockedFormats.has(format))) return;
          if (isSelected) {
            draft.set(
              "rows",
              rows.filter((row) => row.channelId !== channelId || row.format !== format),
            );
            return;
          }
          if (rows.length >= MAX_CHANNEL_ROWS) return;
          const source = channelRows[0];
          if (source === undefined) return;
          draft.set("rows", [...rows, newRow(draft, source, format)]);
        };

        return (
          <section
            key={channelId}
            className="space-y-3"
            aria-label={platformLabels[channel.platform]}
          >
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Formato · {platformLabels[channel.platform]}
              </h3>
              <p className="text-xs text-muted-foreground">{channel.profileName}</p>
            </div>
            <ul className="flex flex-wrap gap-3" aria-label="Formatos disponíveis">
              {platformFormats[channel.platform].map((format) => {
                const Icon = formatIcons[format];
                const isSelected = selectedFormats.has(format);
                const isDisabled =
                  disabled ||
                  lockedFormats.has(format) ||
                  (!isSelected && rows.length >= MAX_CHANNEL_ROWS);
                const rowErrorIndex = rows.findIndex(
                  (row) => row.channelId === channelId && row.format === format,
                );
                const error =
                  rowErrorIndex < 0 ? undefined : errors[`channels.${rowErrorIndex}.format`];

                return (
                  <li key={format}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={contentFormatLabels[format]}
                      aria-disabled={isDisabled}
                      onClick={() => {
                        if (!isDisabled) toggleFormat(format);
                      }}
                      className={cn(
                        "group flex w-16 cursor-pointer flex-col items-center gap-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        isDisabled && "cursor-not-allowed",
                      )}
                    >
                      <span
                        className={cn(
                          "relative flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition duration-200",
                          isSelected
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "opacity-50 grayscale group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0",
                          isDisabled && "group-hover:scale-100",
                          error && "ring-2 ring-destructive ring-offset-2 ring-offset-background",
                        )}
                      >
                        <Icon aria-hidden="true" className="size-5" />
                        {isSelected ? (
                          <span
                            aria-hidden="true"
                            className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border border-background bg-foreground text-background"
                          >
                            <Check className="size-3" />
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          isSelected ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {contentFormatLabels[format]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {rows.length >= MAX_CHANNEL_ROWS ? (
        <p className="text-xs text-muted-foreground" role="status">
          Limite de 20 formatos e publicações por conteúdo.
        </p>
      ) : null}
    </div>
  );
}
