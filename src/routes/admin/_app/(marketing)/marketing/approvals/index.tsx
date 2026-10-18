import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsPage } from "@/components/marketing/approvals/approvals-page";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/approvals/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Approvals.View),
  validateSearch: listSearchSchema,
  pendingComponent: ListSkeleton,
  component: ApprovalsRoute,
});

function ApprovalsRoute() {
  return <ApprovalsPage />;
}
