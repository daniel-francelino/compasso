import { createFileRoute } from "@tanstack/react-router";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { UsersPage } from "@/components/shared/settings/users/users-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(shared)/settings/users")({
  beforeLoad: ({ context }) => requireAction(context, Action.Users.View),
  validateSearch: listSearchSchema,
  pendingComponent: ListSkeleton,
  component: UsersPage,
});
