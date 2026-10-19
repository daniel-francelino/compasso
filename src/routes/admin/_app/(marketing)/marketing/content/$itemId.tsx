import { createFileRoute } from "@tanstack/react-router";
import { ContentEditorPage } from "@/components/marketing/content/content-editor-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/content/$itemId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Content.View),
  component: ContentRoute,
});

function ContentRoute() {
  const { itemId } = Route.useParams();
  return <ContentEditorPage itemId={itemId} />;
}
