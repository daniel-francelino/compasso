import { createFileRoute } from "@tanstack/react-router";
import { VideosPage } from "@/components/shared/video/videos-page";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/videos/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Video.View),
  validateSearch: listSearchSchema,
  pendingComponent: ListSkeleton,
  component: VideosPage,
});
