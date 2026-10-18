import { createFileRoute } from "@tanstack/react-router";
import { NavigationPage } from "@/components/cms/settings/navigation-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(cms)/site/navigation")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.Settings),
  component: NavigationPage,
});
