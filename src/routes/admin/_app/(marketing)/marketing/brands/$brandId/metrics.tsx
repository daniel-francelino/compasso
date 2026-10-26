import { createFileRoute } from "@tanstack/react-router";
import { MetricsPage } from "@/components/marketing/metrics/metrics-page";
import { metricsSearchSchema } from "@/lib/marketing/metrics/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId/metrics")({
  beforeLoad: ({ context }) => requireAction(context, Action.Metrics.View),
  validateSearch: metricsSearchSchema,
  component: MetricsRoute,
});

function MetricsRoute() {
  const { brandId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <MetricsPage
      brandId={brandId}
      search={search}
      onSearch={(patch) =>
        void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true })
      }
    />
  );
}
