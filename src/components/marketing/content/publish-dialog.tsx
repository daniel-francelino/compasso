import { Megaphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { DateTimeField } from "@/components/shared/admin/date-time-field";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { MediaPicker } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { publishSchema } from "@/lib/marketing/content/schemas";
import type { VariantDetail } from "@/lib/marketing/content/types";
import { markPublished } from "@/lib/marketing/content/variants.functions";
import { MediaScope } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";

const EVIDENCE_KINDS = [MediaKind.Image, MediaKind.Document] as const;

export function PublishDialog({
  variant,
  open,
  onOpenChange,
  onPublished,
}: {
  variant: VariantDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished: () => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [publishedAt, setPublishedAt] = useState<string | null>(new Date().toISOString());
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<{ versionId: string; name: string } | null>(null);
  const [picking, setPicking] = useState(false);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Megaphone}
      title="Registrar publicação"
      description="Isto só registra que a publicação aconteceu. O Compasso não publica em nenhuma rede social."
      submitLabel="Registrar publicação"
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            publishSchema,
            {
              id: variant.id,
              publishedAt,
              url,
              note,
              evidenceVersionId: evidence?.versionId ?? null,
            },
            (data) => markPublished({ data }),
            () => {
              toast.success("Publicação registrada.");
              onPublished();
              onOpenChange(false);
            },
          );
        },
      }}
    >
      <DateTimeField
        id="publish-at"
        label="Data e hora da publicação"
        value={publishedAt}
        timeZone={variant.brandTimezone}
        onValueChange={setPublishedAt}
        error={errors["publishedAt"]}
      />
      <TextField
        id="publish-url"
        label="Link da publicação (opcional)"
        value={url}
        onValueChange={setUrl}
        maxLength={500}
        error={errors["url"]}
        hint="Precisa começar com https://"
      />
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Comprovante (opcional)</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setPicking(true)}>
            Escolher da biblioteca
          </Button>
          {evidence ? (
            <>
              <span className="truncate text-sm">{evidence.name}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEvidence(null)}>
                Remover
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <TextAreaField
        id="publish-note"
        label="Nota (opcional)"
        value={note}
        onValueChange={setNote}
        maxLength={1000}
        rows={3}
        error={errors["note"]}
      />
      <FormError message={error} />
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        scope={MediaScope.Brand}
        brandId={variant.brandId}
        kinds={EVIDENCE_KINDS}
        onConfirm={(picked) => {
          const first = picked[0];
          if (first) setEvidence({ versionId: first.versionId, name: first.name });
        }}
      />
    </FormDialog>
  );
}
