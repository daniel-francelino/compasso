import { createFileRoute } from "@tanstack/react-router";
import { BrandLayout } from "@/components/marketing/brands/brand-layout";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Brands.View),
  component: BrandRoute,
});

function BrandRoute() {
  const { brandId } = Route.useParams();
  return <BrandLayout brandId={brandId} />;
}
