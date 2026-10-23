import { History } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ActivityEntry } from "@/components/marketing/content/activity-entry";
import { EmptyState } from "@/components/shared/admin/empty-state";
import type { RequestRow } from "@/lib/marketing/content/types";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { ApprovalRequestStatus, ApprovalOutcome } from "@/lib/shared/enums";
import { formatDateOnly, formatDateTime } from "@/lib/shared/format";
import { approvalOutcomeLabels, approvalStageLabels } from "@/lib/shared/labels";

type HistoryEvent = {
  key: string;
  at: string;
  personId: string | null;
  personName: string;
  action: string;
  detail: string | null;
  quote: string | null;
  requestId: string;
};

const UNKNOWN_PERSON = "Alguém da equipe";

const eventsOf = (request: RequestRow): HistoryEvent[] => {
  const label = `${approvalStageLabels[request.stage]} · Versão ${request.revisionNo}`;
  const sent: HistoryEvent = {
    key: `${request.id}-sent`,
    at: request.requestedAt,
    personId: request.requestedById,
    personName: request.requestedByName ?? UNKNOWN_PERSON,
    action: `enviou ${label} para a aprovação da marca`,
    detail: request.dueDate ? `Prazo ${formatDateOnly(request.dueDate)}` : null,
    quote: null,
    requestId: request.id,
  };
  const decided: HistoryEvent[] =
    request.decidedAt === null || request.outcome === null
      ? []
      : [
          {
            key: `${request.id}-decided`,
            at: request.decidedAt,
            personId: request.decidedById,
            personName: request.decidedByName ?? UNKNOWN_PERSON,
            action: `decidiu ${label}: ${approvalOutcomeLabels[request.outcome ?? ApprovalOutcome.Approved].toLowerCase()}`,
            detail: null,
            quote: request.decisionComment,
            requestId: request.id,
          },
        ];
  const cancelled: HistoryEvent[] =
    request.status === ApprovalRequestStatus.Cancelled && request.cancelledReason !== null
      ? [
          {
            key: `${request.id}-cancelled`,
            at: request.decidedAt ?? request.requestedAt,
            personId: null,
            personName: "Sistema",
            action: `cancelou o pedido de ${label}`,
            detail: `Motivo: ${request.cancelledReason}`,
            quote: null,
            requestId: request.id,
          },
        ]
      : [];
  return [sent, ...decided, ...cancelled];
};

export function RevisionHistory({
  requests,
  newestFirst,
  avatars,
}: {
  requests: RequestRow[];
  newestFirst: boolean;
  avatars: Record<string, string>;
}) {
  const auth = useAuth();
  const events = requests
    .flatMap(eventsOf)
    .sort((a, b) => (newestFirst ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at)));

  if (events.length === 0) {
    return (
      <EmptyState
        compact
        icon={History}
        title="Nenhuma atividade ainda"
        description="Os envios para o cliente e as decisões aparecem aqui."
      />
    );
  }
  return (
    <ol className="space-y-5">
      {events.map((event) => (
        <ActivityEntry
          key={event.key}
          name={event.personName}
          avatarUrl={event.personId === null ? undefined : avatars[event.personId]}
        >
          <p className="text-sm">
            <span className="font-medium">{event.personName}</span> {event.action}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(event.at)}
            {event.detail ? ` · ${event.detail}` : ""}
          </p>
          {event.quote ? (
            <p className="whitespace-pre-wrap wrap-break-word rounded-lg bg-muted/50 px-3 py-2 text-sm">
              “{event.quote}”
            </p>
          ) : null}
          {can(auth, Action.Approvals.View) ? (
            <Link
              to="/admin/marketing/approvals/$requestId"
              params={{ requestId: event.requestId }}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              Abrir pedido
            </Link>
          ) : null}
        </ActivityEntry>
      ))}
    </ol>
  );
}
