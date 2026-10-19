import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BellRing,
  Eye,
  Replace,
  Send,
  TriangleAlert,
  UserCog,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { SelectField } from "@/components/shared/admin/form-fields";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ReasonDialog } from "@/components/shared/admin/reason-dialog";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { RevisionView } from "@/components/shared/preview/revision-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import {
  type ApprovalDetail,
  cancelApprovalRequest,
  getApprovalRequest,
  reassignApprover,
  remindApprover,
} from "@/lib/marketing/approvals/approvals.functions";
import { listApproverOptions } from "@/lib/marketing/content/variants.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { ApprovalRequestStatus } from "@/lib/shared/enums";
import { formatDateOnly, formatDateTime } from "@/lib/shared/format";
import { approvalOutcomeLabels } from "@/lib/shared/labels";
import { signMediaUrls } from "@/lib/shared/media/media.functions";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

type TimelineEvent = { key: string; at: string; text: string };

const timelineOf = (request: ApprovalDetail): TimelineEvent[] => {
  const events: TimelineEvent[] = [
    {
      key: "sent",
      at: request.requestedAt,
      text: `Enviada${request.requestedByName ? ` por ${request.requestedByName}` : ""} para ${request.approverName ?? "o aprovador"}`,
    },
  ];
  if (request.viewedAt) {
    events.push({ key: "viewed", at: request.viewedAt, text: "Aberta pelo aprovador" });
  }
  if (request.decidedAt) {
    events.push({ key: "decided", at: request.decidedAt, text: closingText(request) });
  }
  return events;
};

const closingText = (request: ApprovalDetail): string => {
  if (request.status === ApprovalRequestStatus.Superseded) return "Substituída por uma nova versão";
  if (request.status === ApprovalRequestStatus.Cancelled) return "Pedido cancelado";
  return request.outcome === null
    ? "Decidida"
    : `${approvalOutcomeLabels[request.outcome]}${request.decidedByName ? ` por ${request.decidedByName}` : ""}`;
};

function ReassignDialog({
  request,
  open,
  onOpenChange,
  onDone,
}: {
  request: ApprovalDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (requestId: string) => void;
}) {
  const { run, busy } = useServerAction();
  const [approverId, setApproverId] = useState("");
  const options = useQuery({
    queryKey: QueryKey.Content.approvers(request.brandId),
    queryFn: async () =>
      unwrapResult(await listApproverOptions({ data: { brandId: request.brandId } })).approvers,
    enabled: open,
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={UserCog}
      title="Reatribuir aprovador"
      description="O pedido atual é substituído e um novo pedido da mesma versão vai para a pessoa escolhida."
      submitLabel="Reatribuir"
      submitDisabled={approverId === ""}
      busy={busy}
      onSubmit={async () => {
        const result = await run(() => reassignApprover({ data: { id: request.id, approverId } }), {
          invalidate: [QueryKey.Approvals.all(), QueryKey.Content.all()],
          success: "Aprovador reatribuído.",
        });
        if (!result.ok) return;
        onDone(result.requestId);
        onOpenChange(false);
      }}
    >
      <SelectField
        id="reassign-approver"
        label="Novo aprovador"
        required
        value={approverId}
        onValueChange={setApproverId}
        placeholder="Escolha o aprovador"
        options={(options.data ?? [])
          .filter((person) => person.id !== request.approverId)
          .map((person) => ({ value: person.id, label: person.name }))}
      />
    </FormDialog>
  );
}

export function ApprovalDetailPage({ requestId }: { requestId: string }) {
  const auth = useAuth();
  const { run, busy } = useServerAction();
  const [reassigning, setReassigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const query = useQuery({
    queryKey: QueryKey.Approvals.detail(requestId),
    queryFn: async () =>
      unwrapResult(await getApprovalRequest({ data: { id: requestId } })).request,
  });
  const urls = useSignedUrls(
    (query.data?.revision.media ?? []).map((file) => file.mediaVersionId),
    MediaVariant.Display,
  );

  async function openFile(versionId: string) {
    const result = await signMediaUrls({
      data: { versionIds: [versionId], variant: MediaVariant.Original },
    });
    const url = result.ok ? result.urls[versionId] : undefined;
    if (url === undefined) {
      toast.error("Não foi possível abrir o arquivo agora.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return (
      <RecordUnavailable
        title="Pedido não encontrado"
        message="Ele não existe ou você não tem acesso."
        backTo={AppRoute.Approvals}
        backLabel="Voltar para aprovações"
      />
    );
  }

  const request = query.data;
  const pending = request.status === ApprovalRequestStatus.Pending;
  const canManage = can(auth, Action.Content.Submit) && pending;
  const refresh = [QueryKey.Approvals.all(), QueryKey.Content.all(), QueryKey.Dashboard.all()];
  const snapshot = request.revision.snapshot;

  return (
    <div className="space-y-6">
      <PageHeader
        title={snapshot.title}
        description={`${request.brandName} · Versão ${request.revision.revisionNo}`}
        breadcrumbs={[{ label: "Aprovações", to: AppRoute.Approvals }, { label: snapshot.title }]}
        actions={
          <>
            <RequestStatusBadge status={request.status} />
            {request.overdue ? (
              <StatusBadge tone="negative" icon={TriangleAlert}>
                Atrasada
              </StatusBadge>
            ) : null}
            <Button asChild variant="outline">
              <Link
                to="/admin/marketing/variants/$variantId"
                params={{ variantId: request.variantId }}
              >
                <ArrowRight aria-hidden="true" />
                Abrir variante
              </Link>
            </Button>
          </>
        }
      />
      {request.status === ApprovalRequestStatus.Superseded ? (
        <Alert>
          <Replace aria-hidden="true" />
          <AlertTitle>Esta versão foi substituída</AlertTitle>
          <AlertDescription>
            O cliente deve avaliar a versão mais recente da variante.
          </AlertDescription>
        </Alert>
      ) : null}
      {canManage ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Ações do pedido">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(() => remindApprover({ data: { id: request.id } }), {
                invalidate: refresh,
                success: "Lembrete enviado.",
              })
            }
          >
            <BellRing aria-hidden="true" />
            Reenviar lembrete
          </Button>
          {request.isCurrent ? (
            <Button variant="outline" disabled={busy} onClick={() => setReassigning(true)}>
              <UserCog aria-hidden="true" />
              Reatribuir aprovador
            </Button>
          ) : null}
          <Button variant="outline" disabled={busy} onClick={() => setCancelling(true)}>
            <XCircle aria-hidden="true" />
            Cancelar pedido
          </Button>
        </div>
      ) : null}
      <SectionCard title="O que o cliente vê" icon={Eye}>
        <RevisionView
          title={snapshot.title}
          platform={snapshot.platform}
          profileName={snapshot.profileName}
          format={snapshot.format}
          caption={snapshot.caption}
          callToAction={snapshot.callToAction}
          plannedAt={snapshot.plannedAt}
          plannedTimezone={snapshot.plannedTimezone}
          media={request.revision.media.map((file) => ({
            versionId: file.mediaVersionId,
            name: file.name,
            kind: file.kind,
            altText: file.altText,
          }))}
          urls={urls.data}
          onOpenFile={openFile}
        />
      </SectionCard>
      <SectionCard title="Andamento" icon={Send}>
        <ol className="space-y-2 text-sm">
          {timelineOf(request).map((event) => (
            <li key={event.key} className="flex flex-wrap gap-x-2">
              <span className="font-medium">{formatDateTime(event.at)}</span>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          {request.dueDate ? `Prazo para resposta: ${formatDateOnly(request.dueDate)}. ` : ""}
          {request.message ? `Mensagem enviada: “${request.message}”` : ""}
        </p>
        {request.cancelledReason ? (
          <p className="text-sm">Motivo do cancelamento: {request.cancelledReason}</p>
        ) : null}
      </SectionCard>
      {request.outcome !== null ? (
        <SectionCard title="Decisão">
          <p className="text-sm font-medium">
            {approvalOutcomeLabels[request.outcome]}
            {request.decidedByName ? ` por ${request.decidedByName}` : ""}
          </p>
          {request.decisionComment ? (
            <p className="whitespace-pre-wrap break-words text-sm">“{request.decisionComment}”</p>
          ) : null}
        </SectionCard>
      ) : null}
      <SectionCard title="Comentários do cliente">
        {request.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comentário externo.</p>
        ) : (
          <ul className="space-y-2">
            {request.comments.map((comment) => (
              <li key={comment.id} className="rounded-xl border border-border p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{comment.authorName}</span> ·{" "}
                  {formatDateTime(comment.createdAt)}
                </p>
                <p className="whitespace-pre-wrap break-words">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      {reassigning ? (
        <ReassignDialog
          request={request}
          open
          onOpenChange={(next) => !next && setReassigning(false)}
          onDone={() => void query.refetch()}
        />
      ) : null}
      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancelar pedido"
        description="A variante volta para produção e o aprovador deixa de ver este pedido como pendente."
        confirmLabel="Cancelar pedido"
        onSubmit={async (reason) => {
          const result = await run(
            () => cancelApprovalRequest({ data: { id: request.id, reason } }),
            {
              invalidate: refresh,
              success: "Pedido cancelado.",
            },
          );
          return result.ok ? null : result.message;
        }}
      />
    </div>
  );
}
