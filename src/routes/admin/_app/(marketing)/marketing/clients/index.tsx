import { createFileRoute } from "@tanstack/react-router";
import { ClientsPage } from "@/components/marketing/clients/clients-page";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/clients/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Clients.View),
  validateSearch: listSearchSchema,
  pendingComponent: ListSkeleton,
  component: ClientsPage,
});
