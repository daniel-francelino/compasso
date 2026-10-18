import { createFileRoute } from "@tanstack/react-router";
import { PreviewPage } from "@/components/cms/preview-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(cms)/site/preview/$pageId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.View),
  staticData: { fullScreen: true },
  head: () => ({ meta: [{ title: "Pré-visualização" }, { name: "robots", content: "noindex" }] }),
  component: PreviewRoute,
});

function PreviewRoute() {
  const { pageId } = Route.useParams();
  return <PreviewPage pageId={pageId} />;
}
