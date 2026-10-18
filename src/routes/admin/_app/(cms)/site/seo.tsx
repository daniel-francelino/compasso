import { createFileRoute } from "@tanstack/react-router";
import { SettingsMode, SettingsPage } from "@/components/cms/settings/settings-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(cms)/site/seo")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.Settings),
  component: SeoRoute,
});

function SeoRoute() {
  return <SettingsPage mode={SettingsMode.Seo} />;
}
