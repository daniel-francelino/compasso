import { createFileRoute } from "@tanstack/react-router";
import { VideoEditorPage } from "@/components/shared/video/video-editor-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/videos/$projectId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Video.View),
  component: VideoRoute,
});

function VideoRoute() {
  const { projectId } = Route.useParams();
  return <VideoEditorPage key={projectId} projectId={projectId} />;
}
