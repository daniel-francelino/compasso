import { createFileRoute } from "@tanstack/react-router";
import { ChannelsTab } from "@/components/marketing/channels/channels-tab";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/brands/$brandId/channels")({
  beforeLoad: ({ context }) => requireAction(context, Action.Channels.View),
  component: TabRoute,
});

function TabRoute() {
  const { brandId } = Route.useParams();
  return <ChannelsTab brandId={brandId} />;
}
