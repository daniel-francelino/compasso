import { Flag, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import { IconButton } from "@/components/shared/admin/icon-button";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Button } from "@/components/shared/ui/button";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { deleteMetricMark, saveMetricMark } from "@/lib/marketing/metrics/metrics.functions";
import { saveMarkSchema } from "@/lib/marketing/metrics/schemas";
import { MetricMarkKind } from "@/lib/shared/enums";
import { formatDateOnly } from "@/lib/shared/format";
import type { Mark } from "@/lib/shared/metrics/dto";
import { QueryKey } from "@/lib/shared/query-keys";

const kindLabels: Record<MetricMarkKind, string> = {
  [MetricMarkKind.Campaign]: "Campanha",
  [MetricMarkKind.ViralPost]: "Post que viralizou",
  [MetricMarkKind.Partnership]: "Parceria",
  [MetricMarkKind.Event]: "Evento",
  [MetricMarkKind.Other]: "Outro",
};

const kindOptions = Object.values(MetricMarkKind).map((value) => ({
  value,
  label: kindLabels[value],
}));

function MarkDialog({
  brandId,
  channelId,
  today,
  onClose,
}: {
  brandId: string;
  channelId: string;
  today: string;
  onClose: () => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const { run } = useServerAction();
  const [kind, setKind] = useState<string>(MetricMarkKind.Campaign);
  const [label, setLabel] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState("");
  const invalidate = [QueryKey.Metrics.all(brandId)];

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      icon={Flag}
      title="Nova marca"
      description="Marque o que aconteceu para explicar o gráfico: uma campanha, um post que viralizou, uma parceria."
      submitLabel="Salvar marca"
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            saveMarkSchema,
            { brandId, channelId, kind, label, startsOn, endsOn },
            (data) => run(() => saveMetricMark({ data }), { invalidate, success: "Marca salva." }),
            onClose,
          );
        },
      }}
    >
      <FormError message={error} />
      <SelectField
        id="mark-kind"
        label="Tipo"
        required
        value={kind}
        onValueChange={setKind}
        options={kindOptions}
        error={errors["kind"]}
      />
      <TextField
        id="mark-label"
        label="O que aconteceu"
        required
        value={label}
        onValueChange={setLabel}
        maxLength={140}
        counter
        error={errors["label"]}
      />
      <DatePickerField
        id="mark-starts"
        label="Data"
        required
        value={startsOn}
        onChange={setStartsOn}
        error={errors["startsOn"]}
      />
      <DatePickerField
        id="mark-ends"
        label="Até (opcional)"
        value={endsOn}
        onChange={setEndsOn}
        clearable
        minDate={startsOn}
        error={errors["endsOn"]}
      />
    </FormDialog>
  );
}

export function MarksPanel({
  brandId,
  channelId,
  marks,
  today,
  canEdit,
}: {
  brandId: string;
  channelId: string;
  marks: Mark[];
  today: string;
  canEdit: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Mark | null>(null);
  const { run, busy } = useServerAction();
  const invalidate = [QueryKey.Metrics.all(brandId)];

  return (
    <SectionCard
      title="Marcas e anotações"
      icon={Flag}
      actions={
        canEdit ? (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Nova marca
          </Button>
        ) : null
      }
    >
      {marks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma marca neste período. Marcas aparecem como linhas nos gráficos e ajudam o cliente a
          entender os picos.
        </p>
      ) : (
        <ul className="space-y-2">
          {marks.map((mark) => (
            <li
              key={mark.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <div>
                <p className="font-medium text-foreground">{mark.label}</p>
                <p className="text-xs text-muted-foreground">
                  {kindLabels[mark.kind]} · {formatDateOnly(mark.starts_on)}
                  {mark.ends_on ? ` a ${formatDateOnly(mark.ends_on)}` : ""}
                </p>
              </div>
              {canEdit ? (
                <IconButton
                  label={`Excluir a marca ${mark.label}`}
                  icon={Trash2}
                  destructive
                  disabled={busy}
                  onClick={() => setDeleting(mark)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title="Excluir marca"
        description={`A marca «${deleting?.label ?? ""}» deixa de aparecer nos gráficos.`}
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (deleting === null) return false;
          const result = await run(() => deleteMetricMark({ data: { id: deleting.id } }), {
            invalidate,
            success: "Marca excluída.",
          });
          return result.ok;
        }}
      />
      {creating ? (
        <MarkDialog
          brandId={brandId}
          channelId={channelId}
          today={today}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </SectionCard>
  );
}
