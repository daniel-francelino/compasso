import { createFileRoute } from "@tanstack/react-router";
import { MediaDetailPage } from "@/components/shared/media/media-detail-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(shared)/library/$assetId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Media.View),
  component: MediaRoute,
});

function MediaRoute() {
  const { assetId } = Route.useParams();
  return <MediaDetailPage assetId={assetId} />;
}
