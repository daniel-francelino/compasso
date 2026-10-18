import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { SelectField } from "@/components/shared/admin/form-fields";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { listChannels } from "@/lib/marketing/channels/channels.functions";
import type { ContentItemDetail } from "@/lib/marketing/content/content.functions";
import { saveVariantSchema } from "@/lib/marketing/content/schemas";
import { getVariant, saveVariant } from "@/lib/marketing/content/variants.functions";
import { platformFormats } from "@/lib/shared/editorial/editorial";
import type { ContentFormat } from "@/lib/shared/enums";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const NONE = "none";

export function NewVariantDialog({
  item,
  open,
  onOpenChange,
  onCreated,
}: {
  item: ContentItemDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (variantId: string) => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [channelId, setChannelId] = useState("");
  const [format, setFormat] = useState("");
  const [sourceId, setSourceId] = useState(NONE);

  const channels = useQuery({
    queryKey: QueryKey.Channels.list(item.brandId, { status: "active" }),
    queryFn: async () =>
      unwrapResult(await listChannels({ data: { brandId: item.brandId } })).channels,
    enabled: open,
  });
  const channel = channels.data?.find((candidate) => candidate.id === channelId);
  const formats = channel ? platformFormats[channel.platform] : [];

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Layers}
      title="Adicionar variante"
      description="Uma variante é a adaptação deste conteúdo para um canal e uma publicação."
      submitLabel="Criar variante"
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            saveVariantSchema,
            { contentItemId: item.id, channelId, format, caption: "", media: [] },
            async (data) => {
              if (sourceId === NONE) return saveVariant({ data });
              const source = await getVariant({ data: { id: sourceId } });
              if (!source.ok) return source;
              return saveVariant({
                data: {
                  ...data,
                  caption: source.variant.caption,
                  ...(source.variant.callToAction
                    ? { callToAction: source.variant.callToAction }
                    : {}),
                  media: source.variant.media.map((media) => ({
                    mediaVersionId: media.mediaVersionId,
                    ...(media.altText ? { altText: media.altText } : {}),
                  })),
                },
              });
            },
            (result) => {
              onCreated(result.id);
              onOpenChange(false);
            },
          );
        },
      }}
    >
      <SelectField
        id="variant-channel"
        label="Canal"
        required
        value={channelId}
        onValueChange={(value) => {
          setChannelId(value);
          setFormat("");
        }}
        placeholder={channels.data?.length === 0 ? "Nenhum canal ativo" : "Escolha o canal"}
        options={(channels.data ?? []).map((candidate) => ({
          value: candidate.id,
          label: `${platformLabels[candidate.platform]} · ${candidate.profileName}`,
        }))}
        error={errors["channelId"]}
      />
      <SelectField
        id="variant-format"
        label="Formato"
        required
        value={format}
        disabled={channelId === ""}
        onValueChange={setFormat}
        placeholder="Escolha o formato"
        options={formats.map((value: ContentFormat) => ({
          value,
          label: contentFormatLabels[value],
        }))}
        error={errors["format"]}
      />
      {item.variants.length > 0 ? (
        <SelectField
          id="variant-source"
          label="Duplicar de outra variante"
          value={sourceId}
          onValueChange={setSourceId}
          options={[
            { value: NONE, label: "Começar em branco" },
            ...item.variants.map((variant) => ({
              value: variant.id,
              label: `${platformLabels[variant.platform]} · ${variant.profileName}`,
            })),
          ]}
        />
      ) : null}
      <FormError message={error} />
    </FormDialog>
  );
}
