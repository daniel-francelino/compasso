import { CalendarPlus, Megaphone, Trash2 } from "lucide-react";
import { PlatformMark } from "@/components/shared/preview/platform-mark";
import { DateTimeField } from "@/components/shared/admin/date-time-field";
import { IconButton } from "@/components/shared/admin/icon-button";
import { Button } from "@/components/shared/ui/button";
import type { ContentDraft, DraftRow } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import { formatIcons } from "@/components/shared/content/format-icons";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";

export function ChannelRowsSection({
  draft,
  channels,
  brandTimezone,
  disabled,
  errors,
  canPublish,
  canCancel,
  onPublish,
  onCancelRow,
}: {
  draft: ContentDraft;
  channels: ChannelRow[];
  brandTimezone: string;
  disabled: boolean;
  errors: Record<string, string>;
  canPublish: boolean;
  canCancel: boolean;
  onPublish: (row: DraftRow) => void;
  onCancelRow: (row: DraftRow) => void;
}) {
  const rows = draft.values.rows;
  const channelOf = (id: string) => channels.find((channel) => channel.id === id);
  const channelIds = [...new Set(rows.map((row) => row.channelId))];

  const update = (key: string, patch: Partial<DraftRow>) =>
    draft.set(
      "rows",
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const addAfter = (source: DraftRow) => {
    const index = rows.findIndex((row) => row.key === source.key);
    const copy: DraftRow = {
      key: draft.nextKey(),
      id: undefined,
      channelId: source.channelId,
      format: source.format,
      caption: "",
      plannedAt: null,
      plannedTimezone: null,
      published: false,
      version: undefined,
    };
    draft.set("rows", [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)]);
  };

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Escolha ao menos um canal para definir o formato e a data de cada publicação.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {channelIds.map((channelId) => {
        const channel = channelOf(channelId);
        const channelRows = rows.filter((row) => row.channelId === channelId);
        const lastRow = channelRows.at(-1);

        return (
          <li key={channelId} className="overflow-hidden rounded-xl border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 p-3">
              <div className="flex min-w-0 items-center gap-2">
                {channel ? <PlatformMark platform={channel.platform} className="size-8" /> : null}
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">
                    {channel ? platformLabels[channel.platform] : "Canal"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {channel?.profileName ?? ""}
                  </span>
                </span>
              </div>
              {!disabled && lastRow ? (
                <Button type="button" variant="outline" size="sm" onClick={() => addAfter(lastRow)}>
                  <CalendarPlus aria-hidden="true" />
                  Incluir mais dias e horários neste canal
                </Button>
              ) : null}
            </div>
            <ul className="divide-y divide-border">
              {channelRows.map((row) => {
                const index = rows.findIndex((entry) => entry.key === row.key);
                const rowDisabled = disabled || row.published;
                const FormatIcon = formatIcons[row.format];

                return (
                  <li
                    key={row.key}
                    className="grid gap-3 p-3 md:grid-cols-[minmax(12rem,0.9fr)_minmax(0,1.4fr)_auto] md:items-start"
                  >
                    <div className="flex min-h-10 items-center gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                      <FormatIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                      <span>{contentFormatLabels[row.format]}</span>
                    </div>
                    <DateTimeField
                      id={`row-planned-${row.key}`}
                      label="Data e hora"
                      value={row.plannedAt}
                      timeZone={row.plannedTimezone ?? brandTimezone}
                      disabled={rowDisabled}
                      onValueChange={(value) =>
                        update(row.key, {
                          plannedAt: value,
                          plannedTimezone:
                            value === null ? null : (row.plannedTimezone ?? brandTimezone),
                        })
                      }
                      error={errors[`channels.${index}.plannedAt`]}
                    />
                    <div className="flex items-center gap-1 pt-6">
                      {row.published ? (
                        <span className="text-xs text-muted-foreground">Publicado</span>
                      ) : null}
                      {canPublish && row.id !== undefined && !row.published ? (
                        <IconButton
                          label="Registrar publicação"
                          icon={Megaphone}
                          onClick={() => onPublish(row)}
                        />
                      ) : null}
                      {row.id !== undefined && !row.published && canCancel && rows.length > 1 ? (
                        <IconButton
                          label="Cancelar este canal"
                          icon={Trash2}
                          destructive
                          onClick={() => onCancelRow(row)}
                        />
                      ) : null}
                      {row.id === undefined && !disabled ? (
                        <IconButton
                          label="Remover esta linha"
                          icon={Trash2}
                          destructive
                          onClick={() =>
                            draft.set(
                              "rows",
                              rows.filter((other) => other.key !== row.key),
                            )
                          }
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
