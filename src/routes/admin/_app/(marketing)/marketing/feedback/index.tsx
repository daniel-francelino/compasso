import { createFileRoute } from "@tanstack/react-router";
import { FeedbackPage } from "@/components/marketing/feedback/feedback-page";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { listSearchSchema } from "@/lib/shared/list-search";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/feedback/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Feedback.View),
  validateSearch: listSearchSchema,
  pendingComponent: ListSkeleton,
  component: FeedbackPage,
});
