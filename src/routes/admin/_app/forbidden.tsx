import { Link, createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, House } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PageHeader } from "@/components/shared/admin/page-header";
import { Button } from "@/components/shared/ui/button";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/_app/forbidden")({
  component: ForbiddenPage,
});

function ForbiddenPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Sem acesso" />
      <EmptyState
        icon={ShieldAlert}
        title="Você não tem permissão para ver esta página"
        description="Peça acesso a quem administra a Aura Creative, se precisar dela."
        action={
          <Button asChild>
            <Link to={AppRoute.Admin}>
              <House aria-hidden="true" />
              Voltar ao início
            </Link>
          </Button>
        }
      />
    </div>
  );
}
