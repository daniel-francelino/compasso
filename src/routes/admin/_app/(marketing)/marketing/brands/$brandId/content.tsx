import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content/content-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId/content")({
  beforeLoad: ({ context }) => requireAction(context, Action.Content.View),
  validateSearch: listSearchSchema,
  component: BrandContentRoute,
});

function BrandContentRoute() {
  const { brandId } = Route.useParams();
  return <ContentPage fixedBrandId={brandId} />;
}
