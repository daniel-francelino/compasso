import { createFileRoute } from "@tanstack/react-router";
import { PortalReportPage } from "@/components/portal/metrics/portal-report-page";

export const Route = createFileRoute("/portal/_app/brands/$brandId/metrics/$reportId")({
  component: ReportRoute,
});

function ReportRoute() {
  const { brandId, reportId } = Route.useParams();
  return <PortalReportPage brandId={brandId} reportId={reportId} />;
}
