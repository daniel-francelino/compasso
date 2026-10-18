import { createFileRoute } from "@tanstack/react-router";
import { BrandOverviewTab } from "@/components/marketing/brands/brand-overview-tab";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId/")({
  component: OverviewRoute,
});

function OverviewRoute() {
  const { brandId } = Route.useParams();
  return <BrandOverviewTab brandId={brandId} />;
}
