import { FileStrip } from "@/components/marketing/content/file-strip";
import { RichTextEditor } from "@/components/shared/admin/rich-text-editor";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import { ContentFormat } from "@/lib/shared/enums";

export const PLAN_MEDIA_LIMIT = 10;

export function PlanSection({
  draft,
  disabled,
  errors,
}: {
  draft: ContentDraft;
  disabled: boolean;
  errors: Record<string, string>;
}) {
  const { values } = draft;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        É o que o cliente lê para aprovar a ideia: tema, mensagem e direção do texto.
      </p>
      <RichTextEditor
        id="plan-summary"
        label="Resumo do planejamento"
        value={values.planSummary}
        onValueChange={(value) => draft.set("planSummary", value)}
        disabled={disabled}
        error={errors["planSummary"]}
      />
      <FileStrip
        items={values.planFiles}
        onChange={(items) => draft.set("planFiles", items)}
        brandId={values.brandId}
        formats={[ContentFormat.Other]}
        maxItems={PLAN_MEDIA_LIMIT}
        disabled={disabled || values.brandId === ""}
        error={errors["planMedia"]}
      />
    </div>
  );
}
