import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/components/marketing/calendar/calendar-page";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { calendarSearchSchema } from "@/lib/shared/calendar/search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/calendar/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Calendar.View),
  validateSearch: calendarSearchSchema,
  pendingComponent: ListSkeleton,
  component: CalendarRoute,
});

function CalendarRoute() {
  return <CalendarPage />;
}
