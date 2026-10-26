import { createFileRoute } from "@tanstack/react-router";
import { PortalMetricsPage } from "@/components/portal/metrics/portal-metrics-page";

export const Route = createFileRoute("/portal/_app/brands/$brandId/metrics/")({
  component: MetricsRoute,
});

function MetricsRoute() {
  const { brandId } = Route.useParams();
  return <PortalMetricsPage brandId={brandId} />;
}
