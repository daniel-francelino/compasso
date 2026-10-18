import { createFileRoute, redirect } from "@tanstack/react-router";
import { SettingsIndexPage } from "@/components/shared/settings/settings-index-page";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/_app/(shared)/settings/")({
  beforeLoad: ({ context }) => {
    const allowed = [
      Action.Users.View,
      Action.Roles.Manage,
      Action.Settings.Manage,
      Action.Audit.View,
      Action.Notifications.Configure,
    ].some((action) => can(context.auth, action));
    if (!allowed) throw redirect({ to: AppRoute.Forbidden });
  },
  component: SettingsIndexPage,
});
