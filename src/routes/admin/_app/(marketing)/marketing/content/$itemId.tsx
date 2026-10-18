import { createFileRoute } from "@tanstack/react-router";
import { ItemPage } from "@/components/marketing/content/item-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/content/$itemId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Content.View),
  component: ItemRoute,
});

function ItemRoute() {
  const { itemId } = Route.useParams();
  return <ItemPage itemId={itemId} />;
}
