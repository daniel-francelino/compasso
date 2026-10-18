import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/components/shared/notifications/notifications-page";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/portal/_app/notifications")({
  validateSearch: listSearchSchema,
  component: NotificationsPage,
});
