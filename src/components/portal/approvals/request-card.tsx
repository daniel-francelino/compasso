import { Link } from "@tanstack/react-router";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { RequestDecisionActions } from "@/components/portal/approvals/request-decision-actions";
import { RequestPreview } from "@/components/portal/approvals/request-preview";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { isOverdue } from "@/lib/portal/approvals/overdue";
import { Skeleton } from "@/components/shared/ui/skeleton";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import type { Platform } from "@/lib/shared/enums";
import { formatDateOnly, formatInZone } from "@/lib/shared/format";
import { nextPlanned } from "@/lib/portal/approvals/planned";
import { platformLabels } from "@/lib/shared/labels";

export function RequestCard({
  request,
  brandId,
  mediaUrls,
}: {
  request: PortalRequest;
  brandId: string;
  mediaUrls: Record<string, string> | undefined;
}) {
  const planned = nextPlanned(request);
  return (
    <SectionCard as="li" padding="sm" className="space-y-3">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]">
        <div className="min-w-0 space-y-2">
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
            {[
              ...new Set(
                request.channels.map(
                  (channel) => platformLabels[channel.platform as Platform] ?? channel.platform,
                ),
              ),
            ].join(", ")}{" "}
            · Versão {request.revisionNo}
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {planned !== null ? (
              <span className="flex items-center gap-1">
                <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                Prevista: {formatInZone(planned.at, planned.timezone)}
              </span>
            ) : null}
            {request.dueDate ? <span>Responder até {formatDateOnly(request.dueDate)}</span> : null}
            {!request.isMine && request.approverName ? (
              <span className="text-muted-foreground">Decisão de {request.approverName}</span>
            ) : null}
          </p>
          <RequestDecisionActions request={request} />
        </div>
        <RequestPreview request={request} brandId={brandId} urls={mediaUrls} />
      </div>
    </SectionCard>
  );
}

export function RequestListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-3">
      <ul className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <SectionCard as="li" key={index} padding="sm">
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]">
              <div className="space-y-3">
                <Skeleton className="h-6 w-56 max-w-full" />
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-4 w-72 max-w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-11 w-36" />
                  <Skeleton className="h-11 w-24" />
                </div>
              </div>
              <div className="mx-auto w-full max-w-sm space-y-2">
                <Skeleton className="h-10 w-40 max-w-full" />
                <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </SectionCard>
        ))}
      </ul>
    </div>
  );
}
