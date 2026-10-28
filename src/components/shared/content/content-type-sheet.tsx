import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { EditorSheet } from "@/components/shared/admin/editor-sheet";
import { ContentTypeFields } from "@/components/shared/content/content-type-fields";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { saveContentType } from "@/lib/shared/content-types/content-types.functions";
import { contentTypeInput, emptyContentTypeDraft } from "@/lib/shared/content-types/draft";
import { saveContentTypeSchema } from "@/lib/shared/content-types/schemas";
import { QueryKey } from "@/lib/shared/query-keys";

const FORM_ID = "content-type-sheet-form";

const invalidate = [QueryKey.Content.types(), QueryKey.Content.typeCatalog()];

export function ContentTypeSheet({
  open,
  onClose,
  restoreFocus,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  restoreFocus: (event: Event) => void;
  onCreated: (typeId: string) => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [draft, setDraft] = useState(emptyContentTypeDraft);
  const { run } = useServerAction();

  const close = () => {
    setDraft(emptyContentTypeDraft);
    onClose();
  };

  return (
    <EditorSheet
      open={open}
      onClose={close}
      restoreFocus={restoreFocus}
      title="Novo tipo de conteúdo"
      description="O tipo criado já fica selecionado neste conteúdo."
      formId={FORM_ID}
      busy={busy}
      submitLabel="Criar tipo"
    >
      <form
        id={FORM_ID}
        ref={formRef}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(
            saveContentTypeSchema,
            contentTypeInput(draft),
            (data) => run(() => saveContentType({ data }), { invalidate }),
            (result) => {
              toast.success("Tipo criado.");
              onCreated(result.id);
              close();
            },
          );
        }}
      >
        <ContentTypeFields draft={draft} onChange={setDraft} errors={errors} />
        <FormError message={error} />
      </form>
    </EditorSheet>
  );
}
