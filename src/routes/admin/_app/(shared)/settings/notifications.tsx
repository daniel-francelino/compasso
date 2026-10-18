import { createFileRoute } from "@tanstack/react-router";
import { NotificationDefaultsPage } from "@/components/shared/settings/notifications/notification-defaults-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(shared)/settings/notifications")({
  beforeLoad: ({ context }) => requireAction(context, Action.Notifications.Configure),
  component: NotificationDefaultsPage,
});
