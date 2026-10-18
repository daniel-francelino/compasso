import { Link } from "@tanstack/react-router";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { isOverdue } from "@/lib/portal/approvals/overdue";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { formatDateOnly, formatInZone } from "@/lib/shared/format";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";

export function RequestCard({ request, brandId }: { request: PortalRequest; brandId: string }) {
  return (
    <SectionCard as="li" padding="sm" className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          to="/portal/brands/$brandId/approvals/$requestId"
          params={{ brandId, requestId: request.id }}
          className="min-h-11 py-2 font-medium text-primary underline-offset-4 hover:underline"
        >
          {request.title}
        </Link>
        <span className="flex flex-wrap gap-1">
          {isOverdue(request) ? (
            <StatusBadge tone="negative" icon={TriangleAlert}>
              Prazo vencido
            </StatusBadge>
          ) : null}
          <RequestStatusBadge status={request.status} />
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {platformLabels[request.platform as Platform] ?? request.platform} ·{" "}
        {contentFormatLabels[request.format as ContentFormat] ?? request.format} · Versão{" "}
        {request.revisionNo}
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {request.plannedAt !== null && request.plannedTimezone !== null ? (
          <span className="flex items-center gap-1">
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
            Prevista: {formatInZone(request.plannedAt, request.plannedTimezone)}
          </span>
        ) : null}
        {request.dueDate ? <span>Responder até {formatDateOnly(request.dueDate)}</span> : null}
        {!request.isMine && request.approverName ? (
          <span className="text-muted-foreground">Decisão de {request.approverName}</span>
        ) : null}
      </p>
    </SectionCard>
  );
}
