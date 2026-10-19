import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CircleAlert, CircleCheck, Send, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { SelectField, TextAreaField } from "@/components/shared/admin/form-fields";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { submitSchema } from "@/lib/marketing/content/schemas";
import type { ContentDetail } from "@/lib/marketing/content/types";
import { listApproverOptions, submitForApproval } from "@/lib/marketing/content/workflow.functions";
import { mediaProblem } from "@/lib/shared/editorial/editorial";
import { addDaysToDate, todayInZone } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

type Check = { ok: boolean; warning?: boolean; text: string };

const checksOf = (content: ContentDetail, dirty: boolean): Check[] => {
  const hasContent = content.caption.trim() !== "" || content.media.length > 0;
  const countProblem = mediaProblem(
    content.channels.map((channel) => channel.format),
    content.media.length,
  );
  return [
    { ok: !dirty, text: "As alterações estão salvas" },
    { ok: content.channels.length > 0, text: "Há ao menos um canal" },
    { ok: hasContent, text: "Há legenda ou arquivos" },
    {
      ok: countProblem === null,
      text: countProblem ?? "A quantidade de arquivos serve para os formatos",
    },
    {
      ok: content.media.every((file) => file.available),
      text: "Todos os arquivos estão disponíveis",
    },
    {
      ok: content.channels.every((channel) => !channel.channelArchived),
      text: "Os canais estão ativos",
    },
    {
      ok: content.channels.every(
        (channel) =>
          channel.plannedAt === null || new Date(channel.plannedAt).getTime() > Date.now(),
      ),
      warning: true,
      text: "As datas previstas estão no futuro",
    },
  ];
};

export function SubmitDialog({
  content,
  dirty,
  open,
  onOpenChange,
  onSubmitted,
}: {
  content: ContentDetail;
  dirty: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [approverId, setApproverId] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const options = useQuery({
    queryKey: QueryKey.Content.approvers(content.brandId),
    queryFn: async () =>
      unwrapResult(await listApproverOptions({ data: { brandId: content.brandId } })),
    enabled: open,
  });
  const today = todayInZone(content.brandTimezone);
  const effectiveDue = dueDate ?? addDaysToDate(today, options.data?.defaultDeadlineDays ?? 3);
  const checks = checksOf(content, dirty);
  const blocked = checks.some((check) => !check.ok && check.warning !== true);
  const approvers = options.data?.approvers ?? [];

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Send}
      title="Enviar para aprovação"
      description={`Isto cria a versão nº ${content.nextRevisionNo}. O cliente verá exatamente esta versão, com todos os canais.`}
      submitLabel="Enviar para aprovação"
      submitDisabled={blocked || approvers.length === 0}
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            submitSchema,
            {
              id: content.id,
              approverId,
              dueDate: effectiveDue,
              message,
              expectedVersion: content.version,
            },
            (data) => submitForApproval({ data }),
            (result) => {
              toast.success(`Versão ${result.revisionNo} enviada para aprovação.`);
              onSubmitted();
              onOpenChange(false);
            },
          );
        },
      }}
    >
      <ul className="space-y-1.5 text-sm" aria-label="Verificações antes de enviar">
        {checks.map((check) => {
          const Icon = check.ok ? CircleCheck : check.warning ? TriangleAlert : CircleAlert;
          return (
            <li key={check.text} className="flex items-start gap-2">
              <Icon
                className={
                  check.ok
                    ? "mt-0.5 size-4 shrink-0 text-success"
                    : "mt-0.5 size-4 shrink-0 text-foreground"
                }
                aria-hidden="true"
              />
              <span>
                {check.text}
                {check.ok
                  ? ""
                  : check.warning
                    ? " — confira antes de enviar."
                    : " — corrija para enviar."}
              </span>
            </li>
          );
        })}
      </ul>
      {options.isSuccess && approvers.length === 0 ? (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          Esta marca ainda não tem um aprovador com permissão de decidir.{" "}
          <Link
            to="/admin/marketing/brands/$brandId/members"
            params={{ brandId: content.brandId }}
            className="text-primary underline-offset-4 hover:underline"
          >
            Convidar aprovador
          </Link>
        </p>
      ) : (
        <SelectField
          id="submit-approver"
          label="Quem vai aprovar"
          required
          value={approverId}
          onValueChange={setApproverId}
          placeholder="Escolha o aprovador"
          options={approvers.map((person) => ({ value: person.id, label: person.name }))}
          error={errors["approverId"]}
        />
      )}
      <DatePickerField
        id="submit-due"
        label="Prazo para a resposta"
        value={effectiveDue}
        minDate={today}
        onChange={setDueDate}
        error={errors["dueDate"]}
      />
      <TextAreaField
        id="submit-message"
        label="Mensagem para o aprovador (opcional)"
        value={message}
        onValueChange={setMessage}
        maxLength={1000}
        rows={3}
        error={errors["message"]}
      />
      <FormError message={error} />
    </FormDialog>
  );
}
