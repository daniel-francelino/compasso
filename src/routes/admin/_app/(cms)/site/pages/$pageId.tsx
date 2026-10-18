import { createFileRoute } from "@tanstack/react-router";
import { PageEditorPage } from "@/components/cms/page-editor/page-editor-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(cms)/site/pages/$pageId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.View),
  component: PageEditorRoute,
});

function PageEditorRoute() {
  const { pageId } = Route.useParams();
  return <PageEditorPage pageId={pageId} />;
}
