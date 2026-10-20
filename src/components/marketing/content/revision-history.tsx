import { EmptyState } from "@/components/shared/admin/empty-state";
import { Link } from "@tanstack/react-router";
import { History } from "lucide-react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import type { RequestRow } from "@/lib/marketing/content/types";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { formatDateOnly, formatDateTime } from "@/lib/shared/format";
import { approvalStageLabels } from "@/lib/shared/labels";

export function RevisionHistory({ requests }: { requests: RequestRow[] }) {
  const auth = useAuth();
  return (
    <SectionCard title="Versões enviadas e decisões" icon={History}>
      {requests.length === 0 ? (
        <EmptyState
          compact
          icon={History}
          title="Nenhuma versão enviada"
          description="Nenhuma versão foi enviada ao cliente ainda."
        />
      ) : (
        <ol className="space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="space-y-1 rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {approvalStageLabels[request.stage]} · Versão {request.revisionNo}
                </span>
                <RequestStatusBadge status={request.status} />
                {can(auth, Action.Approvals.View) ? (
                  <Link
                    to="/admin/marketing/approvals/$requestId"
                    params={{ requestId: request.id }}
                    className="ml-auto text-primary underline-offset-4 hover:underline"
                  >
                    Abrir pedido
                  </Link>
                ) : null}
              </div>
              <p className="text-muted-foreground">
                Enviada em {formatDateTime(request.requestedAt)}
                {request.requestedByName ? ` por ${request.requestedByName}` : ""} para a aprovação
                da marca
                {request.dueDate ? ` · prazo ${formatDateOnly(request.dueDate)}` : ""}
              </p>
              {request.decidedAt ? (
                <p className="text-muted-foreground">
                  Decidida em {formatDateTime(request.decidedAt)}
                </p>
              ) : null}
              {request.decisionComment ? (
                <p className="whitespace-pre-wrap break-words">“{request.decisionComment}”</p>
              ) : null}
              {request.cancelledReason ? (
                <p className="text-muted-foreground">Motivo: {request.cancelledReason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
