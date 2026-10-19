import { Link, Outlet } from "@tanstack/react-router";
import {
  Archive,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Images,
  LayoutDashboard,
  Palette,
  Radio,
  Settings2,
  Users,
} from "lucide-react";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { PageHeader } from "@/components/shared/admin/page-header";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { useBrand } from "@/hooks/marketing/use-brand";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { AppRoute } from "@/lib/shared/routes";

const tabClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 [&_svg]:size-4 [&_svg]:shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground";

export function BrandLayout({ brandId }: { brandId: string }) {
  const auth = useAuth();
  const query = useBrand(brandId);

  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return (
      <RecordUnavailable
        title="Marca não encontrada"
        message="Ela não existe ou você não tem acesso."
        backTo={AppRoute.Brands}
        backLabel="Voltar para marcas"
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
          <LayoutDashboard aria-hidden="true" />
          Visão geral
        </Link>
        {can(auth, Action.Channels.View) ? (
          <Link
            to="/admin/marketing/brands/$brandId/channels"
            params={{ brandId }}
            className={tabClass}
          >
            <Radio aria-hidden="true" />
            Canais
          </Link>
        ) : null}
        {can(auth, Action.Content.View) ? (
          <Link
            to="/admin/marketing/brands/$brandId/content"
            params={{ brandId }}
            className={tabClass}
          >
            <FileText aria-hidden="true" />
            Conteúdos
          </Link>
        ) : null}
        {can(auth, Action.Calendar.View) ? (
          <Link
            to="/admin/marketing/brands/$brandId/calendar"
            params={{ brandId }}
            className={tabClass}
          >
            <CalendarDays aria-hidden="true" />
            Calendário
          </Link>
        ) : null}
        {can(auth, Action.Approvals.View) ? (
          <Link
            to="/admin/marketing/brands/$brandId/approvals"
            params={{ brandId }}
            className={tabClass}
          >
            <ClipboardCheck aria-hidden="true" />
            Aprovações
          </Link>
        ) : null}
        {can(auth, Action.Media.View) ? (
          <Link
            to="/admin/marketing/brands/$brandId/library"
            params={{ brandId }}
            className={tabClass}
          >
            <Images aria-hidden="true" />
            Biblioteca
          </Link>
        ) : null}
        <Link
          to="/admin/marketing/brands/$brandId/members"
          params={{ brandId }}
          className={tabClass}
        >
          <Users aria-hidden="true" />
          Membros
        </Link>
        <Link
          to="/admin/marketing/brands/$brandId/identity"
          params={{ brandId }}
          className={tabClass}
        >
          <Palette aria-hidden="true" />
          Identidade
        </Link>
        {can(auth, Action.Brands.Update) ? (
          <Link
            to="/admin/marketing/brands/$brandId/settings"
            params={{ brandId }}
            className={tabClass}
          >
            <Settings2 aria-hidden="true" />
            Configurações
          </Link>
        ) : null}
      </nav>
      <Outlet />
    </div>
  );
}
