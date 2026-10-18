import { FileStrip } from "@/components/marketing/content/file-strip";
import { DateTimeField } from "@/components/shared/admin/date-time-field";
import { SelectField, TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { SectionCard } from "@/components/shared/admin/section-card";
import type { VariantDraft } from "@/hooks/marketing/use-variant-draft";
import type { VariantDetail } from "@/lib/marketing/content/types";
import { fileCountProblem, platformFormats } from "@/lib/shared/editorial/editorial";
import { contentFormatLabels } from "@/lib/shared/labels";

const MAX_CAPTION = 5000;

export function VariantFields({
  variant,
  draft,
  errors,
  disabled,
}: {
  variant: VariantDetail;
  draft: VariantDraft;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  const zone = variant.plannedTimezone ?? variant.brandTimezone;
  return (
    <SectionCard title="Conteúdo da variante">
      <SelectField
        id="variant-format-edit"
        label="Formato"
        required
        value={draft.format}
        disabled={disabled}
        onValueChange={(value) => {
          const match = platformFormats[variant.platform].find((format) => format === value);
          if (match) draft.setFormat(match);
        }}
        options={platformFormats[variant.platform].map((format) => ({
          value: format,
          label: contentFormatLabels[format],
        }))}
        error={errors["format"]}
      />
      <TextAreaField
        id="variant-caption"
        label="Legenda"
        value={draft.caption}
        disabled={disabled}
        onValueChange={draft.setCaption}
        maxLength={MAX_CAPTION}
        rows={8}
        error={errors["caption"]}
      />
      <TextField
        id="variant-cta"
        label="Chamada para ação"
        value={draft.callToAction}
        disabled={disabled}
        onValueChange={draft.setCallToAction}
        maxLength={300}
        error={errors["callToAction"]}
      />
      <FileStrip
        items={draft.files}
        onChange={draft.setFiles}
        brandId={variant.brandId}
        format={draft.format}
        disabled={disabled}
        error={errors["media"] ?? fileCountProblem(draft.format, draft.files.length) ?? undefined}
      />
      <DateTimeField
        id="variant-planned"
        label="Data e hora prevista"
        value={draft.plannedAt}
        timeZone={zone}
        disabled={disabled}
        onValueChange={draft.setPlannedAt}
        error={errors["plannedAt"]}
        hint="É uma data de planejamento. O Compasso não publica sozinho."
      />
    </SectionCard>
  );
}
