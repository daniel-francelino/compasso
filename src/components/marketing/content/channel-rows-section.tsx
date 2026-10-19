import { CalendarPlus, Megaphone, Trash2 } from "lucide-react";
import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import { DateTimeField } from "@/components/shared/admin/date-time-field";
import { SelectField } from "@/components/shared/admin/form-fields";
import { IconButton } from "@/components/shared/admin/icon-button";
import { Button } from "@/components/shared/ui/button";
import type { ContentDraft, DraftRow } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import { platformFormats } from "@/lib/shared/editorial/editorial";
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
      {rows.map((row, index) => {
        const channel = channelOf(row.channelId);
        const formats = channel ? platformFormats[channel.platform] : [];
        const rowDisabled = disabled || row.published;
        const sameChannel = rows.filter((other) => other.channelId === row.channelId);
        return (
          <li
            key={row.key}
            className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-start"
          >
            <div className="flex items-center gap-2 pt-1">
              {channel ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <PlatformIcon platform={channel.platform} className="size-4" />
                </span>
              ) : null}
              <span className="min-w-0 text-sm">
                <span className="block truncate font-medium">
                  {channel ? platformLabels[channel.platform] : "Canal"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {channel?.profileName ?? ""}
                </span>
              </span>
            </div>
            <SelectField
              id={`row-format-${row.key}`}
              label="Formato"
              value={row.format}
              disabled={rowDisabled}
              onValueChange={(value) => {
                const match = formats.find((format) => format === value);
                if (match) update(row.key, { format: match });
              }}
              options={formats.map((format) => ({
                value: format,
                label: contentFormatLabels[format],
              }))}
              error={errors[`channels.${index}.format`]}
            />
            <DateTimeField
              id={`row-planned-${row.key}`}
              label="Data e hora"
              value={row.plannedAt}
              timeZone={row.plannedTimezone ?? brandTimezone}
              disabled={rowDisabled}
              onValueChange={(value) =>
                update(row.key, {
                  plannedAt: value,
                  plannedTimezone: value === null ? null : (row.plannedTimezone ?? brandTimezone),
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
              {row.id === undefined && !disabled && rows.length > 1 ? (
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
            {sameChannel.at(-1)?.key === row.key && !disabled ? (
              <div className="md:col-span-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => addAfter(row)}>
                  <CalendarPlus aria-hidden="true" />
                  Incluir mais dias e horários neste canal
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
