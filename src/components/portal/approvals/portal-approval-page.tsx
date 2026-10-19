import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Ban, Check, MessageSquareWarning, Replace } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PortalComments } from "@/components/portal/approvals/portal-comments";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { TextAreaField } from "@/components/shared/admin/form-fields";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { RevisionView } from "@/components/shared/preview/revision-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import { useDecisionDraft } from "@/hooks/portal/use-decision-draft";
import { usePortalUrls } from "@/hooks/portal/use-portal-urls";
import {
  decidePortalApproval,
  getPortalApproval,
  recordPortalView,
  signPortalMedia,
} from "@/lib/portal/approvals/portal.functions";
import { MIN_CHANGE_COMMENT } from "@/lib/portal/approvals/schemas";
import type { PortalApproval } from "@/lib/portal/approvals/types";
import {
  ApprovalOutcome,
  ApprovalRequestStatus,
  type ContentFormat,
  type Platform,
} from "@/lib/shared/enums";
import { formatDateOnly, formatDateTime } from "@/lib/shared/format";
import { approvalOutcomeLabels } from "@/lib/shared/labels";
import { kindOfMime } from "@/lib/shared/media/limits";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

function StateNotice({ approval }: { approval: PortalApproval }) {
  const { request } = approval;
  if (request.status === ApprovalRequestStatus.Superseded) {
    return (
      <Alert>
        <Replace aria-hidden="true" />
        <AlertTitle>Esta versão foi atualizada</AlertTitle>
        <AlertDescription>
          A equipe enviou uma versão nova.{" "}
          {approval.currentRequestId ? (
            <Link
              to="/portal/brands/$brandId/approvals/$requestId"
              params={{ brandId: approval.brandId, requestId: approval.currentRequestId }}
              className="text-primary underline-offset-4 hover:underline"
            >
              Ver a versão atual
            </Link>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }
  if (request.status === ApprovalRequestStatus.Cancelled) {
    return (
      <Alert>
        <Ban aria-hidden="true" />
        <AlertTitle>Este pedido foi cancelado</AlertTitle>
        <AlertDescription>Não é preciso fazer nada.</AlertDescription>
      </Alert>
    );
  }
  if (request.status === ApprovalRequestStatus.Pending && !approval.isDesignated) {
    return (
      <Alert>
        <AlertTitle>Você pode comentar</AlertTitle>
        <AlertDescription>
          A decisão é de {request.approverName ?? "outra pessoa"}.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}

function DecisionCard({ approval }: { approval: PortalApproval }) {
  if (approval.decision === null) return null;
  return (
    <SectionCard title="Decisão registrada">
      <p className="text-sm font-medium">
        {approvalOutcomeLabels[approval.decision.outcome]}
        {approval.decision.decidedByName ? ` por ${approval.decision.decidedByName}` : ""} em{" "}
        {formatDateTime(approval.decision.decidedAt)}
      </p>
      {approval.decision.comment ? (
        <p className="whitespace-pre-wrap break-words text-sm">“{approval.decision.comment}”</p>
      ) : null}
    </SectionCard>
  );
}

function History({ approval }: { approval: PortalApproval }) {
  if (approval.history.length === 0) return null;
  return (
    <SectionCard title="Versões anteriores">
      <ul className="space-y-2 text-sm">
        {approval.history.map((item) => (
          <li key={item.requestId} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Versão {item.revisionNo}</span>
            <RequestStatusBadge status={item.status} />
            <span className="text-muted-foreground">{formatDateTime(item.requestedAt)}</span>
            {item.comment ? <span className="basis-full">“{item.comment}”</span> : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function PortalApprovalPage({ brandId, requestId }: { brandId: string; requestId: string }) {
  const queryClient = useQueryClient();
  const draft = useDecisionDraft(requestId);
  const viewed = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: QueryKey.Portal.approval(requestId),
    queryFn: async () =>
      unwrapResult(await getPortalApproval({ data: { id: requestId } })).approval,
  });
  const approval = query.data;
  const urls = usePortalUrls(
    approval?.revisionId ?? "",
    (approval?.media ?? []).map((item) => item.versionId),
    MediaVariant.Display,
  );

  useEffect(() => {
    if (viewed.current || approval === undefined) return;
    viewed.current = true;
    if (approval.isDesignated && approval.request.status === ApprovalRequestStatus.Pending) {
      void recordPortalView({ data: { id: requestId } });
    }
  }, [approval, requestId]);

  async function openFile(versionId: string) {
    if (approval === undefined) return;
    const result = await signPortalMedia({
      data: {
        revisionId: approval.revisionId,
        versionIds: [versionId],
        variant: MediaVariant.Original,
      },
    });
    const url = result.ok ? result.urls[versionId] : undefined;
    if (url === undefined) {
      toast.error("Não foi possível abrir o arquivo agora. Tente de novo.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function decide(outcome: ApprovalOutcome, comment: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    const result = await decidePortalApproval({ data: { id: requestId, outcome, comment } });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      void query.refetch();
      return false;
    }
    draft.clear();
    toast.success(
      outcome === ApprovalOutcome.Approved
        ? "Aprovação registrada."
        : "Pedido de alterações enviado.",
    );
    await queryClient.invalidateQueries({ queryKey: QueryKey.Portal.all() });
    await queryClient.invalidateQueries({ queryKey: QueryKey.Notifications.all() });
    return true;
  }

  if (query.isPending) return <PageSkeleton />;
  if (query.isError || approval === undefined) {
    return (
      <RecordUnavailable
        title="Você não tem acesso a esta marca"
        message="Este pedido não existe ou não está disponível para você."
        backTo={"/portal"}
        backLabel="Voltar"
      />
    );
  }

  const { request } = approval;
  return (
    <div className="space-y-6 pb-28 sm:pb-0">
      <div>
        <Button asChild variant="ghost" className="-ml-3 min-h-11">
          <Link to="/portal/brands/$brandId/approvals" params={{ brandId }}>
            <ArrowLeft aria-hidden="true" />
            Aprovações · {approval.brandName}
          </Link>
        </Button>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="heading-page">{request.title}</h1>
          <RequestStatusBadge status={request.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {request.dueDate
            ? `Prazo para responder: ${formatDateOnly(request.dueDate)}`
            : "Sem prazo definido"}
        </p>
        {approval.message ? (
          <p className="mt-2 rounded-md border border-border bg-muted p-3 text-sm">
            Mensagem da equipe: “{approval.message}”
          </p>
        ) : null}
      </div>
      <StateNotice approval={approval} />
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Não foi possível registrar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <RevisionView
        title={request.title}
        platform={request.platform as Platform}
        profileName={request.profileName}
        format={request.format as ContentFormat}
        caption={approval.caption}
        callToAction={approval.callToAction}
        plannedAt={request.plannedAt}
        plannedTimezone={request.plannedTimezone ?? request.brandTimezone}
        media={approval.media.map((item) => ({
          versionId: item.versionId,
          name: item.name,
          kind: kindOfMime(item.mimeType),
          altText: item.altText,
        }))}
        urls={urls.data}
        onOpenFile={openFile}
      />
      <DecisionCard approval={approval} />
      <History approval={approval} />
      <PortalComments variantId={request.variantId} />
      {approval.canDecide ? (
        <div
          className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-border bg-background p-3 sm:static sm:border-0 sm:p-0"
          role="group"
          aria-label="Sua decisão"
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={busy}
            onClick={() => setAsking(true)}
          >
            <MessageSquareWarning aria-hidden="true" />
            Pedir alterações
          </Button>
          <Button
            type="button"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <Check aria-hidden="true" />
            Aprovar
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Aprovar esta versão?"
        description="A equipe será avisada de que você aprovou exatamente o que está nesta tela. A decisão não pode ser desfeita por você."
        confirmLabel="Aprovar"
        busy={busy}
        onConfirm={() => decide(ApprovalOutcome.Approved, "")}
      />
      <FormDialog
        open={asking}
        onOpenChange={setAsking}
        icon={MessageSquareWarning}
        title="Pedir alterações"
        description="Conte à equipe o que precisa mudar. O comentário é obrigatório."
        submitLabel="Enviar pedido"
        submitDisabled={draft.text.trim().length < MIN_CHANGE_COMMENT}
        busy={busy}
        onSubmit={async () => {
          if (await decide(ApprovalOutcome.ChangesRequested, draft.text.trim())) setAsking(false);
        }}
      >
        <TextAreaField
          id="portal-changes"
          label="O que precisa mudar"
          value={draft.text}
          onValueChange={draft.change}
          maxLength={4000}
          rows={5}
          disabled={busy}
          error={
            draft.text.length > 0 && draft.text.trim().length < MIN_CHANGE_COMMENT
              ? "Escreva ao menos 5 letras."
              : undefined
          }
        />
      </FormDialog>
    </div>
  );
}
