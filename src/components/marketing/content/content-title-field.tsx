import { FieldMessage } from "@/components/shared/admin/form-fields";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
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
    <div className="space-y-1">
      <Label htmlFor="content-title" className="sr-only">
        Nome do conteúdo
      </Label>
      <Input
        id="content-title"
        name="content-title"
        value={draft.values.title}
        disabled={disabled}
        maxLength={140}
        placeholder="Novo conteúdo"
        aria-invalid={error ? true : undefined}
        aria-required
        onChange={(event) => draft.set("title", event.target.value)}
        className="h-auto border-0 bg-transparent px-0 py-1 font-display text-4xl font-semibold shadow-none focus-visible:ring-0 md:text-4xl"
      />
      <FieldMessage error={error} />
    </div>
  );
}
