import { createFileRoute } from "@tanstack/react-router";
import { PortalCalendarPage } from "@/components/portal/calendar/portal-calendar-page";
import { portalCalendarSearchSchema } from "@/lib/shared/calendar/search";

export const Route = createFileRoute("/portal/_app/brands/$brandId/calendar")({
  validateSearch: portalCalendarSearchSchema,
  component: PortalCalendarRoute,
});

function PortalCalendarRoute() {
  const { brandId } = Route.useParams();
  return <PortalCalendarPage brandId={brandId} />;
}
