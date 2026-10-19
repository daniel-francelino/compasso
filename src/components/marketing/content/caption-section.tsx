import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import { TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { platformDescriptors } from "@/lib/shared/preview/platforms";

export const ALL_TAB = "all";

const MAX_CAPTION = 5000;

export function CaptionSection({
  draft,
  channels,
  active,
  onActive,
  disabled,
  errors,
}: {
  draft: ContentDraft;
  channels: ChannelRow[];
  active: string;
  onActive: (tab: string) => void;
  disabled: boolean;
  errors: Record<string, string>;
}) {
  const rows = draft.values.rows;
  const channelOf = (id: string) => channels.find((channel) => channel.id === id);
  const tab = rows.some((row) => row.key === active) ? active : ALL_TAB;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={onActive}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value={ALL_TAB}>Todos</TabsTrigger>
          {rows.map((row) => {
            const channel = channelOf(row.channelId);
            const sameChannel = rows.filter((other) => other.channelId === row.channelId);
            return (
              <TabsTrigger key={row.key} value={row.key}>
                {channel ? <PlatformIcon platform={channel.platform} /> : null}
                {channel ? platformLabels[channel.platform] : "Canal"}
                {sameChannel.length > 1 ? ` · ${contentFormatLabels[row.format]}` : ""}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value={ALL_TAB}>
          <TextAreaField
            id="content-caption"
            label="Texto do post"
            value={draft.values.caption}
            disabled={disabled}
            onValueChange={(value) => draft.set("caption", value)}
            maxLength={MAX_CAPTION}
            rows={8}
            error={errors["caption"]}
          />
        </TabsContent>
        {rows.map((row, index) => {
          const channel = channelOf(row.channelId);
          const limit = channel ? platformDescriptors[channel.platform].captionLimit : null;
          const shown = row.caption === "" ? draft.values.caption : row.caption;
          return (
            <TabsContent key={row.key} value={row.key} className="space-y-2">
              <TextAreaField
                id={`row-caption-${row.key}`}
                label={`Ajuste para ${channel ? platformLabels[channel.platform] : "este canal"}`}
                tip={{
                  label: "Ajuda sobre o ajuste do texto",
                  content:
                    "Deixe vazio para usar o texto de “Todos”. Escreva aqui só o que muda neste canal.",
                }}
                value={row.caption}
                disabled={disabled || row.published}
                onValueChange={(value) =>
                  draft.set(
                    "rows",
                    rows.map((other) =>
                      other.key === row.key ? { ...other, caption: value } : other,
                    ),
                  )
                }
                maxLength={MAX_CAPTION}
                rows={8}
                error={errors[`channels.${index}.caption`]}
              />
              {limit !== null && shown.length > limit ? (
                <p role="status" className="text-xs text-destructive">
                  O texto passa de {limit} caracteres, o limite sugerido para{" "}
                  {channel ? platformLabels[channel.platform] : "este canal"}.
                </p>
              ) : null}
            </TabsContent>
          );
        })}
      </Tabs>
      <TextField
        id="content-cta"
        label="Chamada para ação"
        value={draft.values.callToAction}
        disabled={disabled}
        onValueChange={(value) => draft.set("callToAction", value)}
        maxLength={300}
        error={errors["callToAction"]}
      />
    </div>
  );
}
