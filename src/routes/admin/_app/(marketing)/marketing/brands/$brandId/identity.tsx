import { createFileRoute } from "@tanstack/react-router";
import { BrandIdentityTab } from "@/components/marketing/brands/brand-identity-tab";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId/identity")({
  component: TabRoute,
});

function TabRoute() {
  const { brandId } = Route.useParams();
  return <BrandIdentityTab brandId={brandId} />;
}
