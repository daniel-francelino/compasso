import { createFileRoute } from "@tanstack/react-router";
import { EntriesPage } from "@/components/cms/entries-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";
import { SiteEntryKind } from "@/lib/shared/enums";

export const Route = createFileRoute("/admin/_app/(cms)/site/testimonials")({
  beforeLoad: ({ context }) => requireAction(context, Action.Site.View),
  component: TestimonialsRoute,
});

function TestimonialsRoute() {
  return <EntriesPage kind={SiteEntryKind.Testimonial} />;
}
