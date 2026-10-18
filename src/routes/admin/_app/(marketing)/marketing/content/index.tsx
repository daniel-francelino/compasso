import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content/content-page";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/content/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Content.View),
  validateSearch: listSearchSchema,
  pendingComponent: ListSkeleton,
  component: ContentRoute,
});

function ContentRoute() {
  return <ContentPage />;
}
