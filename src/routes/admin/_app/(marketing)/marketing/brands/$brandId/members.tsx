import { createFileRoute } from "@tanstack/react-router";
import { BrandMembersTab } from "@/components/marketing/brands/brand-members-tab";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId/members")({
  component: TabRoute,
});

function TabRoute() {
  const { brandId } = Route.useParams();
  return <BrandMembersTab brandId={brandId} />;
}
