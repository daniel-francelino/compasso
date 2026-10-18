import { createFileRoute } from "@tanstack/react-router";
import { MessagesPage } from "@/components/cms/messages-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(cms)/site/messages")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.View),
  component: MessagesPage,
});
