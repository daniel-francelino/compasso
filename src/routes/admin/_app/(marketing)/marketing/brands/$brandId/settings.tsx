import { createFileRoute } from "@tanstack/react-router";
import { BrandSettingsTab } from "@/components/marketing/brands/brand-settings-tab";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId/settings")({
  beforeLoad: ({ context }) => requireAction(context, Action.Brands.Update),
  component: TabRoute,
});

function TabRoute() {
  const { brandId } = Route.useParams();
  return <BrandSettingsTab brandId={brandId} />;
}
