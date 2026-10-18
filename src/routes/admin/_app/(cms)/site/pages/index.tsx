import { createFileRoute } from "@tanstack/react-router";
import { PagesListPage } from "@/components/cms/pages-list-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(cms)/site/pages/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.View),
  component: PagesListPage,
});
