import { createFileRoute } from "@tanstack/react-router";
import { OrganizationPage } from "@/components/shared/settings/organization/organization-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(shared)/settings/organization")({
  beforeLoad: ({ context }) => requireAction(context, Action.Settings.Manage),
  component: OrganizationPage,
});
