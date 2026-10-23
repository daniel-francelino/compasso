import { ClipboardList } from "lucide-react";
import { ContentSettingsSection } from "@/components/marketing/content/content-settings-section";
import { SectionCard } from "@/components/shared/admin/section-card";
import { TextAreaField } from "@/components/shared/admin/form-fields";
import { RichTextEditor } from "@/components/shared/admin/rich-text-editor";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import { BRIEFING_FIELD_MAX, briefingFieldSpecs } from "@/lib/marketing/content/briefing-fields";

export function BriefingStep({
  draft,
  disabled,
  objectiveLocked,
  errors,
}: {
  draft: ContentDraft;
  disabled: boolean;
  objectiveLocked: boolean;
  errors: Record<string, string>;
}) {
  const { values, set } = draft;
  return (
    <SectionCard
      title="Briefing"
      icon={ClipboardList}
      tip={{
        label: "Sobre o briefing",
        content:
          "Passagem de bastão para a equipe de produção. É interno: o cliente não vê nada desta etapa.",
      }}
    >
      <div className="space-y-4">
        <ContentSettingsSection
          draft={draft}
          disabled={disabled}
          objectiveLocked={objectiveLocked}
          errors={errors}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {briefingFieldSpecs.map((spec) => (
            <TextAreaField
              key={spec.key}
              id={`content-briefing-${spec.key}`}
              label={spec.label}
              value={values.briefingFields[spec.key]}
              disabled={disabled}
              onValueChange={(value) =>
                set("briefingFields", { ...values.briefingFields, [spec.key]: value })
              }
              maxLength={BRIEFING_FIELD_MAX}
              rows={spec.rows}
              placeholder={spec.placeholder}
              error={errors[`briefingFields.${spec.key}`]}
            />
          ))}
        </div>
        <RichTextEditor
          id="content-briefing"
          label="Detalhes e notas"
          value={values.briefing}
          disabled={disabled}
          onValueChange={(value) => set("briefing", value)}
          placeholder="Referências, combinados e dúvidas em aberto para quem vai produzir."
          error={errors["briefing"]}
        />
      </div>
    </SectionCard>
  );
}
