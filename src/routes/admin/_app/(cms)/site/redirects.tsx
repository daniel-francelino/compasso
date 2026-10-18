import { createFileRoute } from "@tanstack/react-router";
import { RedirectsPage } from "@/components/cms/settings/redirects-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(cms)/site/redirects")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.Settings),
  component: RedirectsPage,
});
