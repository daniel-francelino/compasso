import { createFileRoute } from "@tanstack/react-router";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { LibraryPage } from "@/components/shared/media/library-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(shared)/library/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Media.View),
  validateSearch: listSearchSchema,
  pendingComponent: ListSkeleton,
  component: () => <LibraryPage />,
});
