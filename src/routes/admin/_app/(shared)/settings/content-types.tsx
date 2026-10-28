import { createFileRoute } from "@tanstack/react-router";
import { ContentTypesPage } from "@/components/shared/settings/content-types/content-types-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(shared)/settings/content-types")({
  beforeLoad: ({ context }) => requireAction(context, Action.Settings.Manage),
  component: ContentTypesPage,
});
