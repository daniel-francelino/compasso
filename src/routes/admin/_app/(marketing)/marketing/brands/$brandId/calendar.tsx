import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/components/marketing/calendar/calendar-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { calendarSearchSchema } from "@/lib/shared/calendar/search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId/calendar")({
  beforeLoad: ({ context }) => requireAction(context, Action.Calendar.View),
  validateSearch: calendarSearchSchema,
  component: BrandCalendarRoute,
});

function BrandCalendarRoute() {
  const { brandId } = Route.useParams();
  return <CalendarPage fixedBrandId={brandId} />;
}
