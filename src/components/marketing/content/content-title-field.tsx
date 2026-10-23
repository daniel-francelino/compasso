import { TextField } from "@/components/shared/admin/form-fields";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";

export function ContentTitleField({
  draft,
  disabled,
  error,
}: {
  draft: ContentDraft;
  disabled: boolean;
  error: string | undefined;
}) {
  return (
    <TextField
      id="content-title"
      label="Título interno"
      required
      value={draft.values.title}
      disabled={disabled}
      onValueChange={(value) => draft.set("title", value)}
      maxLength={140}
      placeholder="Ex.: Campanha de inverno — chocolate quente"
      error={error}
      hint="O cliente só vê este título se ele fizer parte do que for enviado."
    />
  );
}
