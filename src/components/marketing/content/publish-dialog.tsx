import { ArrowLeft, Check, Megaphone, Images, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "lost-ui/elements/modal";
import { Form } from "lost-ui/forms/form";
import { FormInput } from "lost-ui/forms/form-input";
import { FormTextarea } from "lost-ui/forms/form-textarea";
import { rules } from "lost-ui/forms/rules";
import { Alert, AlertDescription } from "lost-ui/ui/alert";
import { DateTimeField } from "@/components/shared/admin/date-time-field";
import { MediaPicker } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { markPublished } from "@/lib/marketing/content/workflow.functions";
import { MediaScope } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";
import { nowIso } from "@/lib/shared/dates";

const EVIDENCE_KINDS = [MediaKind.Image, MediaKind.Document] as const;

export function PublishDialog({
  channelRowId,
  channelLabel,
  brandId,
  brandTimezone,
  open,
  onOpenChange,
  onPublished,
}: {
  channelRowId: string;
  channelLabel: string;
  brandId: string;
  brandTimezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished: () => void;
}) {
  const { errors, error, busy, send } = useFormSubmit();
  const [publishedAt, setPublishedAt] = useState<string | null>(nowIso());
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<{ versionId: string; name: string } | null>(null);
  const [picking, setPicking] = useState(false);

  function handleSubmit() {
    void send(
      () =>
        markPublished({
          data: {
            id: channelRowId,
            publishedAt: publishedAt ?? "",
            url,
            note,
            evidenceVersionId: evidence?.versionId ?? null,
          },
        }),
      () => {
        toast.success("Publicação registrada.");
        onPublished();
        onOpenChange(false);
      },
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!busy}
      title={
        <span className="flex items-center gap-2">
          <Megaphone className="size-5 text-muted-foreground" aria-hidden="true" />
          Registrar publicação
        </span>
      }
      description={`Isto só registra que a publicação em ${channelLabel} aconteceu. A Aura Creative não publica em nenhuma rede social.`}
      footer={({ close }) => (
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={close}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
          <Button type="submit" form="publish-form" disabled={publishedAt === null} loading={busy}>
            <Check aria-hidden="true" />
            Registrar publicação
          </Button>
        </>
      )}
    >
      <Form id="publish-form" className="space-y-4" onSubmit={handleSubmit}>
        <DateTimeField
          id="publish-at"
          label="Data da publicação"
          value={publishedAt}
          timeZone={brandTimezone}
          onValueChange={setPublishedAt}
          error={errors["publishedAt"]}
        />
        <FormInput
          name="url"
          label="Link da publicação (opcional)"
          value={url}
          onValueChange={setUrl}
          hint="Precisa começar com https://"
          rules={[
            rules.maxLength(500, "O link é longo demais."),
            rules.when(
              (value: string) => value !== "",
              rules.pattern(/^https:\/\//, "O link precisa começar com https://"),
            ),
            rules.when((value: string) => value !== "", rules.url("Informe um link válido.")),
          ]}
          error={errors["url"] !== undefined}
          {...(errors["url"] ? { errorMessage: errors["url"] } : {})}
        />
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Comprovante (opcional)</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setPicking(true)}>
              <Images aria-hidden="true" />
              Escolher da biblioteca
            </Button>
            {evidence ? (
              <>
                <span className="truncate text-sm">{evidence.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEvidence(null)}>
                  <Trash2 aria-hidden="true" />
                  Remover
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <FormTextarea
          name="note"
          label="Nota (opcional)"
          value={note}
          onValueChange={setNote}
          rows={3}
          rules={[rules.maxLength(1000, "A nota é longa demais.")]}
          error={errors["note"] !== undefined}
          {...(errors["note"] ? { errorMessage: errors["note"] } : {})}
        />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </Form>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        scope={MediaScope.Brand}
        brandId={brandId}
        kinds={EVIDENCE_KINDS}
        onConfirm={(picked) => {
          const first = picked[0];
          if (first) setEvidence({ versionId: first.versionId, name: first.name });
        }}
      />
    </Modal>
  );
}
