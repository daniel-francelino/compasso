import { createFileRoute } from "@tanstack/react-router";
import { PortalApprovalsPage } from "@/components/portal/approvals/portal-approvals-page";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/portal/_app/brands/$brandId/approvals/")({
  validateSearch: listSearchSchema,
  component: ApprovalsRoute,
});

function ApprovalsRoute() {
  const { brandId } = Route.useParams();
  return <PortalApprovalsPage brandId={brandId} />;
}
