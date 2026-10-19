import { createFileRoute } from "@tanstack/react-router";
import { PublicSharePage } from "@/components/shared/media/public-share-page";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "Arquivos compartilhados" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ShareRoute,
});

function ShareRoute() {
  const { token } = Route.useParams();
  return <PublicSharePage token={token} />;
}
