import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { DateTimeField } from "@/components/shared/admin/date-time-field";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import { Alert, AlertDescription } from "@/components/shared/ui/alert";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { deadlineSchema, rescheduleSchema } from "@/lib/marketing/calendar/schemas";
import {
  rescheduleProductionDeadline,
  rescheduleVariant,
} from "@/lib/marketing/calendar/calendar.functions";
import { resolveLocalTime } from "@/lib/shared/calendar/reschedule";
import { EditorialStatus } from "@/lib/shared/enums";
import { formatDateOnly, formatInZone } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";

export type RescheduleTarget =
  | {
      kind: "publication";
      variantId: string;
      title: string;
      brandTimezone: string;
      editorialStatus: EditorialStatus;
      currentAt: string | null;
      version: number;
      initialLocal?: string;
    }
  | {
      kind: "deadline";
      itemId: string;
      title: string;
      currentDate: string;
      version: number;
      initialDate?: string;
    };

const NEEDS_NEW_APPROVAL: EditorialStatus[] = [
  EditorialStatus.AwaitingApproval,
  EditorialStatus.Approved,
];

const initialInstant = (target: RescheduleTarget): string | null => {
  if (target.kind !== "publication") return null;
  if (target.initialLocal === undefined) return target.currentAt;
  const resolved = resolveLocalTime(target.initialLocal, target.brandTimezone);
  return resolved.ok ? resolved.instant.toISOString() : null;
};

export function RescheduleDialog({
  target,
  onOpenChange,
}: {
  target: RescheduleTarget;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [plannedAt, setPlannedAt] = useState<string | null>(() => initialInstant(target));
  const [date, setDate] = useState(
    target.kind === "deadline" ? (target.initialDate ?? target.currentDate) : "",
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: QueryKey.Calendar.all() });
  const publication = target.kind === "publication" ? target : null;
  const deadline = target.kind === "deadline" ? target : null;
  const resubmits =
    publication !== null && NEEDS_NEW_APPROVAL.includes(publication.editorialStatus);
  const inPast = plannedAt !== null && new Date(plannedAt).getTime() < Date.now();

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      icon={CalendarClock}
      title={publication ? "Alterar data de publicação" : "Alterar prazo de produção"}
      description={target.title}
      submitLabel="Confirmar nova data"
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          if (publication) {
            void submit(
              rescheduleSchema,
              {
                variantId: publication.variantId,
                plannedAt,
                timezone: publication.brandTimezone,
                expectedVersion: publication.version,
              },
              (data) => rescheduleVariant({ data }),
              (result) => {
                toast.success(
                  result.resubmitted
                    ? "Data alterada. Uma nova versão foi enviada para aprovação."
                    : "Data alterada.",
                );
                void refresh();
                onOpenChange(false);
              },
            );
            return;
          }
          if (deadline === null) return;
          void submit(
            deadlineSchema,
            { itemId: deadline.itemId, date, expectedVersion: deadline.version },
            (data) => rescheduleProductionDeadline({ data }),
            () => {
              toast.success("Prazo alterado.");
              void refresh();
              onOpenChange(false);
            },
          );
        },
      }}
    >
      {publication ? (
        <>
          {publication.currentAt !== null ? (
            <p className="text-sm text-muted-foreground">
              Data atual: {formatInZone(publication.currentAt, publication.brandTimezone)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Este conteúdo ainda não tem data.</p>
          )}
          <DateTimeField
            id="reschedule-at"
            label="Nova data e hora"
            value={plannedAt}
            timeZone={publication.brandTimezone}
            initialLocal={publication.initialLocal}
            onValueChange={setPlannedAt}
            error={errors["plannedAt"]}
          />
          {plannedAt !== null ? (
            <p className="text-sm">
              Nova data: <strong>{formatInZone(plannedAt, publication.brandTimezone)}</strong>
            </p>
          ) : null}
          {resubmits ? (
            <Alert>
              <TriangleAlert aria-hidden="true" className="size-4" />
              <AlertDescription>
                Mudar a data de um conteúdo enviado cria uma nova versão e exige nova aprovação. A
                aprovação pendente será substituída.
              </AlertDescription>
            </Alert>
          ) : null}
          {inPast ? (
            <Alert>
              <TriangleAlert aria-hidden="true" className="size-4" />
              <AlertDescription>A data escolhida já passou.</AlertDescription>
            </Alert>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Prazo atual: {formatDateOnly(deadline?.currentDate ?? date)}
          </p>
          <DatePickerField
            id="reschedule-deadline"
            label="Novo prazo"
            value={date}
            onChange={setDate}
            error={errors["date"]}
          />
        </>
      )}
      <FormError message={error} />
    </FormDialog>
  );
}
