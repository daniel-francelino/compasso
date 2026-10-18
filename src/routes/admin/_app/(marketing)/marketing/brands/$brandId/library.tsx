import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/shared/media/library-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId/library")({
  beforeLoad: ({ context }) => requireAction(context, Action.Media.View),
  validateSearch: listSearchSchema,
  component: BrandLibraryRoute,
});

function BrandLibraryRoute() {
  const { brandId } = Route.useParams();
  return <LibraryPage fixedBrandId={brandId} />;
}
