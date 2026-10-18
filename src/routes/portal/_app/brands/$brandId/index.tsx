import { createFileRoute } from "@tanstack/react-router";
import { PortalBrandPage } from "@/components/portal/approvals/portal-brand-page";

export const Route = createFileRoute("/portal/_app/brands/$brandId/")({
  component: BrandRoute,
});

function BrandRoute() {
  const { brandId } = Route.useParams();
  return <PortalBrandPage brandId={brandId} />;
}
