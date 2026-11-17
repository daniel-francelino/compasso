import { createFileRoute } from "@tanstack/react-router";
import { DesignEditorPage } from "@/components/shared/design/design-editor-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/designs/$designId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Design.View),
  staticData: { fullScreen: true },
  component: DesignRoute,
});

function DesignRoute() {
  const { designId } = Route.useParams();
  return <DesignEditorPage key={designId} designId={designId} />;
}
