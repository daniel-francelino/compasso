import { createFileRoute } from "@tanstack/react-router";
import { ApprovalDetailPage } from "@/components/marketing/approvals/approval-detail-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/approvals/$requestId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Approvals.View),
  component: ApprovalRoute,
});

function ApprovalRoute() {
  const { requestId } = Route.useParams();
  return <ApprovalDetailPage requestId={requestId} />;
}
