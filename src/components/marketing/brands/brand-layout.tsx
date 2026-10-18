import { Link, Outlet } from "@tanstack/react-router";
import { Archive } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PageHeader } from "@/components/shared/admin/page-header";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { useBrand } from "@/hooks/marketing/use-brand";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { AppRoute } from "@/lib/shared/routes";

const tabClass =
  "inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground";

export function BrandLayout({ brandId }: { brandId: string }) {
  const auth = useAuth();
  const query = useBrand(brandId);

  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return (
      <EmptyState
        title="Marca não encontrada"
        description="Ela não existe ou você não tem acesso."
        action={
          <Button asChild>
            <Link to={AppRoute.Brands}>Voltar para marcas</Link>
          </Button>
        }
      />
    );
  }

  const brand = query.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title={brand.name}
        description={brand.clientName}
        breadcrumbs={[{ label: "Marcas", to: AppRoute.Brands }, { label: brand.name }]}
        actions={
          brand.archived ? (
            <StatusBadge tone="neutral" icon={Archive}>
              Arquivada
            </StatusBadge>
          ) : null
        }
      />
      <nav
        aria-label="Seções da marca"
        className="flex flex-wrap gap-1 border-b border-border pb-2"
      >
        <Link
          to="/admin/marketing/brands/$brandId"
          params={{ brandId }}
          activeOptions={{ exact: true }}
          className={tabClass}
        >
          Visão geral
        </Link>
        {can(auth, Action.Channels.View) ? (
          <Link
            to="/admin/marketing/brands/$brandId/channels"
            params={{ brandId }}
            className={tabClass}
          >
            Canais
          </Link>
        ) : null}
        {can(auth, Action.Media.View) ? (
          <Link
            to="/admin/marketing/brands/$brandId/library"
            params={{ brandId }}
            className={tabClass}
          >
            Biblioteca
          </Link>
        ) : null}
        <Link
          to="/admin/marketing/brands/$brandId/members"
          params={{ brandId }}
          className={tabClass}
        >
          Membros
        </Link>
        <Link
          to="/admin/marketing/brands/$brandId/identity"
          params={{ brandId }}
          className={tabClass}
        >
          Identidade
        </Link>
        {can(auth, Action.Brands.Update) ? (
          <Link
            to="/admin/marketing/brands/$brandId/settings"
            params={{ brandId }}
            className={tabClass}
          >
            Configurações
          </Link>
        ) : null}
      </nav>
      <Outlet />
    </div>
  );
}
