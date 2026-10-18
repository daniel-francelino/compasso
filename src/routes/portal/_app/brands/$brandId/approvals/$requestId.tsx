import { createFileRoute } from "@tanstack/react-router";
import { PortalApprovalPage } from "@/components/portal/approvals/portal-approval-page";

export const Route = createFileRoute("/portal/_app/brands/$brandId/approvals/$requestId")({
  component: ApprovalRoute,
});

function ApprovalRoute() {
  const { brandId, requestId } = Route.useParams();
  return <PortalApprovalPage brandId={brandId} requestId={requestId} />;
}
