import { createFileRoute } from "@tanstack/react-router";
import { PublicationsPage } from "@/components/cms/publications-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(cms)/site/publications")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.Publish),
  component: PublicationsPage,
});
