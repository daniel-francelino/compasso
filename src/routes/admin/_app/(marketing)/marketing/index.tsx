import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/marketing/dashboard/dashboard-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAnyAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/")({
  beforeLoad: ({ context }) =>
    requireAnyAction(context, [Action.Brands.View, Action.Content.View, Action.Approvals.View]),
  validateSearch: listSearchSchema,
  component: DashboardPage,
});
