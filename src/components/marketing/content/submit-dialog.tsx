import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CircleCheck,
  Send,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "lost-ui/elements/modal";
import { Form } from "lost-ui/forms/form";
import { FormInputDate } from "lost-ui/forms/form-input-date";
import { FormTextarea } from "lost-ui/forms/form-textarea";
import { rules } from "lost-ui/forms/rules";
import { Alert, AlertDescription } from "lost-ui/ui/alert";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import type { ContentDetail } from "@/lib/marketing/content/types";
import { listApproverOptions, submitForApproval } from "@/lib/marketing/content/workflow.functions";
import { mediaProblem, submitStageOf } from "@/lib/shared/editorial/editorial";
import { ApprovalStage } from "@/lib/shared/enums";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import {
  addDaysToDate,
  isInFuture,
  parseDateValue,
  toDateValue,
  todayInZone,
} from "@/lib/shared/dates";

type Check = { ok: boolean; warning?: boolean; text: string };

const futureDates = (content: ContentDetail): Check => ({
  ok: content.channels.every(
    (channel) => channel.plannedAt === null || isInFuture(channel.plannedAt),
  ),
  warning: true,
  text: "As datas previstas estão no futuro",
});

const planChecks = (content: ContentDetail, dirty: boolean): Check[] => [
  { ok: !dirty, text: "As alterações estão salvas" },
  { ok: content.channels.length > 0, text: "Há ao menos um canal" },
  {
    ok: content.channels.some((channel) => channel.plannedAt !== null),
    text: "Ao menos um canal tem data e horário",
  },
  {
    ok: content.planMedia.every((file) => file.available),
    text: "Todos os arquivos do planejamento estão disponíveis",
  },
  {
    ok: content.channels.every((channel) => !channel.channelArchived),
    text: "Os canais estão ativos",
  },
  futureDates(content),
];

const artChecks = (content: ContentDetail, dirty: boolean): Check[] => {
  const countProblem = mediaProblem(
    content.channels.map((channel) => channel.format),
    content.media.length,
  );
  return [
    { ok: !dirty, text: "As alterações estão salvas" },
    { ok: content.channels.length > 0, text: "Há ao menos um canal" },
    {
      ok: content.caption.trim() !== "" || content.media.length > 0,
      text: "Há legenda ou arquivos",
    },
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
    futureDates(content),
  ];
};

const copyOf = (stage: ApprovalStage) =>
  stage === ApprovalStage.Plan
    ? {
        title: "Enviar para aprovação",
        submit: "Enviar",
        subject: "do planejamento",
        seen: "canais, formatos, datas, resumo e imagens do planejamento",
      }
    : {
        title: "Enviar para aprovação",
        submit: "Enviar",
        subject: "do conteúdo",
        seen: "texto, arquivos e canais",
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
  const { errors, error, busy, send } = useFormSubmit();
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const stage = submitStageOf(content.caption, content.media.length);
  const copy = copyOf(stage);

  const options = useQuery({
    queryKey: QueryKey.Content.approvers(content.brandId),
    queryFn: async () =>
      unwrapResult(await listApproverOptions({ data: { brandId: content.brandId } })),
    enabled: open,
  });
  const today = todayInZone(content.brandTimezone);
  const effectiveDue = dueDate ?? addDaysToDate(today, options.data?.defaultDeadlineDays ?? 3);
  const checks =
    stage === ApprovalStage.Plan ? planChecks(content, dirty) : artChecks(content, dirty);
  const blocked = checks.some((check) => !check.ok && check.warning !== true);
  const approvers = options.data?.approvers ?? [];

  const dueValue = parseDateValue(effectiveDue) ?? null;
  const earliest = parseDateValue(today);

  function handleSubmit() {
    void send(
      () =>
        submitForApproval({
          data: {
            id: content.id,
            dueDate: effectiveDue,
            message,
            expectedVersion: content.version,
          },
        }),
      (result) => {
        toast.success(`Versão ${result.revisionNo} enviada para aprovação.`);
        onSubmitted();
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
          <Send className="size-5 text-muted-foreground" aria-hidden="true" />
          {copy.title}
        </span>
      }
      description={`Isto cria a versão nº ${content.nextRevisionNo} ${copy.subject}. O cliente verá exatamente esta versão.`}
      footer={({ close }) => (
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={close}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
          <Button
            type="submit"
            form="submit-approval-form"
            disabled={blocked || approvers.length === 0}
            loading={busy}
          >
            <Check aria-hidden="true" />
            {copy.submit}
          </Button>
        </>
      )}
    >
      <Form id="submit-approval-form" className="space-y-4" onSubmit={handleSubmit}>
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
            Ninguém desta marca pode aprovar ainda.{" "}
            <Link
              to="/admin/marketing/brands/$brandId/members"
              params={{ brandId: content.brandId }}
              className="text-primary underline-offset-4 hover:underline"
            >
              Convidar aprovador
            </Link>
          </p>
        ) : (
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <UsersRound className="size-4 text-muted-foreground" aria-hidden="true" />
              Quem será avisado
              <InfoTip label="Sobre quem aprova">
                Qualquer pessoa da marca com permissão de aprovar pode decidir. A primeira decisão
                vale. O cliente verá: {copy.seen}.
              </InfoTip>
            </p>
            <p className="text-sm text-muted-foreground">
              {approvers.map((person) => person.name).join(", ")}
            </p>
          </div>
        )}
        <FormInputDate
          name="dueDate"
          label="Prazo para a resposta"
          value={dueValue}
          {...(earliest ? { min: earliest } : {})}
          onValueChange={(value) =>
            setDueDate(value === null || !("getTime" in value) ? null : toDateValue(value))
          }
          rules={[
            rules.required("Informe o prazo para a resposta."),
            ...(earliest ? [rules.minDate(earliest, "O prazo não pode estar no passado.")] : []),
          ]}
          error={errors["dueDate"] !== undefined}
          {...(errors["dueDate"] ? { errorMessage: errors["dueDate"] } : {})}
        />
        <FormTextarea
          name="message"
          label="Mensagem para quem aprova (opcional)"
          value={message}
          onValueChange={setMessage}
          rows={3}
          rules={[rules.maxLength(1000, "A mensagem é longa demais.")]}
          error={errors["message"] !== undefined}
          {...(errors["message"] ? { errorMessage: errors["message"] } : {})}
        />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </Form>
    </Modal>
  );
}
