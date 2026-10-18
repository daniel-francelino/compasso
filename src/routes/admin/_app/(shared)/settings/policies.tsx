import { createFileRoute } from "@tanstack/react-router";
import { PoliciesPage } from "@/components/shared/settings/organization/policies-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(shared)/settings/policies")({
  beforeLoad: ({ context }) => requireAction(context, Action.Settings.Manage),
  component: PoliciesPage,
});
