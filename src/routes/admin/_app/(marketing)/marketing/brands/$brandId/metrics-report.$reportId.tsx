import { createFileRoute } from "@tanstack/react-router";
import { ReportBuilderPage } from "@/components/marketing/metrics/report-builder-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute(
  "/admin/_app/(marketing)/marketing/brands/$brandId/metrics-report/$reportId",
)({
  beforeLoad: ({ context }) => requireAction(context, Action.Metrics.View),
  component: ReportRoute,
});

function ReportRoute() {
  const { brandId, reportId } = Route.useParams();
  return <ReportBuilderPage brandId={brandId} reportId={reportId} />;
}
