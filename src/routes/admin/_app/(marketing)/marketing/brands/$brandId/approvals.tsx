import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsPage } from "@/components/marketing/approvals/approvals-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId/approvals")(
  {
    beforeLoad: ({ context }) => requireAction(context, Action.Approvals.View),
    validateSearch: listSearchSchema,
    component: BrandApprovalsRoute,
  },
);

function BrandApprovalsRoute() {
  const { brandId } = Route.useParams();
  return <ApprovalsPage fixedBrandId={brandId} />;
}
