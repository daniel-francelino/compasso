import { createFileRoute } from "@tanstack/react-router";
import { RolesPage } from "@/components/shared/settings/roles/roles-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(shared)/settings/roles")({
  beforeLoad: ({ context }) => requireAction(context, Action.Roles.Manage),
  component: RolesPage,
});
