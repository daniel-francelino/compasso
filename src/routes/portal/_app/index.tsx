import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/_app/")({
  component: PortalHomePage,
});

function PortalHomePage() {
  return (
    <section>
      <h1 className="heading-page">Portal do Cliente</h1>
      <p className="mt-2 text-muted-foreground">Seus conteúdos para aprovação aparecerão aqui.</p>
    </section>
  );
}
