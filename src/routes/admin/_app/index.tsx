import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared/admin/page-header";

export const Route = createFileRoute("/admin/_app/")({
  component: HomePage,
});

function HomePage() {
  const { auth } = Route.useRouteContext();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Início"
        description={`Olá, ${auth.profile?.name ?? ""}. O painel chega junto com os módulos.`}
      />
    </div>
  );
}
