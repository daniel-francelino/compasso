import { createFileRoute } from "@tanstack/react-router";
import { PortalFeedPage } from "@/components/portal/feed/portal-feed-page";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/portal/_app/brands/$brandId/")({
  validateSearch: listSearchSchema,
  component: BrandRoute,
});

function BrandRoute() {
  const { brandId } = Route.useParams();
  return <PortalFeedPage brandId={brandId} />;
}
