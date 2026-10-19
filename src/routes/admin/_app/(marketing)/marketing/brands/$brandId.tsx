import { createFileRoute } from "@tanstack/react-router";
import { BrandLayout } from "@/components/marketing/brands/brand-layout";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { brandQueryOptions } from "@/hooks/marketing/use-brand";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Brands.View),
  loader: ({ context, params }) =>
    context.queryClient.prefetchQuery(brandQueryOptions(params.brandId)),
  pendingComponent: PageSkeleton,
  pendingMs: 150,
  pendingMinMs: 300,
  component: BrandRoute,
});

function BrandRoute() {
  const { brandId } = Route.useParams();
  return <BrandLayout brandId={brandId} />;
}
