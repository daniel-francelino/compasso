import { createFileRoute } from "@tanstack/react-router";
import { VariantEditorPage } from "@/components/marketing/content/variant-editor-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/variants/$variantId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Content.View),
  component: VariantRoute,
});

function VariantRoute() {
  const { variantId } = Route.useParams();
  return <VariantEditorPage variantId={variantId} />;
}
