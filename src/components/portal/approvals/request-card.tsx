import { ClipboardList, Maximize2 } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { PortalApprovalDialog } from "@/components/portal/approvals/portal-approval-dialog";
import { PlanRequestSummary } from "@/components/portal/approvals/plan-request-summary";
import { RequestDecisionActions } from "@/components/portal/approvals/request-decision-actions";
import { RequestPreview } from "@/components/portal/approvals/request-preview";
import { ResponseDeadlineBadge } from "@/components/portal/approvals/response-deadline-badge";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { ApprovalStage } from "@/lib/shared/enums";
import { approvalStageLabels } from "@/lib/shared/labels";

const INTERACTIVE = "button, a, input, textarea, select, video, audio, [role=tab], [role=button]";

export function RequestCard({
  request,
  brandId,
  mediaUrls,
}: {
  request: PortalRequest;
  brandId: string;
  mediaUrls: Record<string, string> | undefined;
}) {
  const [open, setOpen] = useState(false);

  function openFromPreview(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest(INTERACTIVE) !== null) return;
    setOpen(true);
  }

  return (
    <SectionCard as="li" padding="sm" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 rounded-md py-2 text-left font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {request.title}
        </button>
        <span className="flex flex-wrap items-center gap-1.5">
          <ResponseDeadlineBadge request={request} />
          <StatusBadge tone="neutral" icon={ClipboardList}>
            {approvalStageLabels[request.stage]}
          </StatusBadge>
          <RequestStatusBadge status={request.status} />
        </span>
      </div>
      <div className="cursor-pointer" onClick={openFromPreview}>
        {request.stage === ApprovalStage.Plan ? (
          <PlanRequestSummary request={request} />
        ) : (
          <RequestPreview request={request} brandId={brandId} urls={mediaUrls} />
        )}
      </div>
      {request.decidedByName ? (
        <p className="text-center text-sm text-muted-foreground">
          Decidido por {request.decidedByName}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
          <Maximize2 aria-hidden="true" />
          Ver detalhes
        </Button>
        <RequestDecisionActions request={request} />
      </div>
      {open ? (
        <PortalApprovalDialog
          brandId={brandId}
          requestId={request.id}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </SectionCard>
  );
}

export function RequestListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-3">
      <ul className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <SectionCard as="li" key={index} padding="sm" className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-6 w-48 max-w-full" />
              <Skeleton className="h-6 w-36 max-w-full" />
            </div>
            <div className="mx-auto w-full max-w-sm space-y-3">
              <Skeleton className="h-8 w-full rounded-full" />
              <Skeleton className="aspect-4/5 w-full rounded-2xl" />
            </div>
            <div className="flex justify-between gap-2 border-t border-border pt-3">
              <Skeleton className="h-11 w-32" />
              <Skeleton className="h-11 w-48" />
            </div>
          </SectionCard>
        ))}
      </ul>
    </div>
  );
}
