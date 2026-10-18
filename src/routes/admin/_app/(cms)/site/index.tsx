import { createFileRoute } from "@tanstack/react-router";
import { SiteOverviewPage } from "@/components/cms/site-overview-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(cms)/site/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.View),
  component: SiteOverviewPage,
});
