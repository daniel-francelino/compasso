import { createFileRoute } from "@tanstack/react-router";
import { ClientDetailPage } from "@/components/marketing/clients/client-detail-page";
import { Action } from "@/lib/shared/auth/actions";
import { requireAction } from "@/lib/shared/auth/guards";

export const Route = createFileRoute("/admin/_app/(marketing)/marketing/clients/$clientId")({
  beforeLoad: ({ context }) => requireAction(context, Action.Clients.View),
  component: ClientRoute,
});

function ClientRoute() {
  const { clientId } = Route.useParams();
  return <ClientDetailPage clientId={clientId} />;
}
