import { createFileRoute } from "@tanstack/react-router";
import { PortfolioPage } from "@/components/cms/portfolio-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(cms)/site/portfolio")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.View),
  component: PortfolioPage,
});
