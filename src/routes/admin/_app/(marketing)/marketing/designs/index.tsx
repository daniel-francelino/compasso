import { createFileRoute } from "@tanstack/react-router";
import { DesignsPage } from "@/components/shared/design/designs-page";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/designs/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Design.View),
  validateSearch: listSearchSchema,
  pendingComponent: ListSkeleton,
  component: DesignsPage,
});
