import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { BrandAvatar } from "@/components/shared/admin/brand-avatar";
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
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { IconButton } from "@/components/shared/admin/icon-button";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { PageHeader } from "@/components/shared/admin/page-header";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { useBrand } from "@/hooks/marketing/use-brand";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { deleteBrand, setBrandArchived } from "@/lib/marketing/brands/brands.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { AppRoute } from "@/lib/shared/routes";
import { QueryKey } from "@/lib/shared/query-keys";

const tabClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 [&_svg]:size-4 [&_svg]:shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground";

export function BrandLayout({ brandId }: { brandId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { run, busy } = useServerAction();
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
        leading={<BrandAvatar name={brand.name} logoUrl={brand.logoUrl} size="lg" />}
        description={brand.clientName}
        breadcrumbs={[{ label: "Marcas", to: AppRoute.Brands }, { label: brand.name }]}
        actions={
          <>
            {can(auth, Action.Brands.Update) ? (
              <IconButton
                variant="outline"
                icon={brand.archived ? Undo2 : Archive}
                label={brand.archived ? "Reativar marca" : "Arquivar marca"}
                onClick={() => setArchiving(true)}
              />
            ) : null}
            {can(auth, Action.Brands.Delete) ? (
              <IconButton
                variant="outline"
                icon={Trash2}
                label="Excluir marca"
                destructive
                onClick={() => setDeleting(true)}
              />
            ) : null}
            {brand.archived ? (
              <StatusBadge tone="neutral" icon={Archive}>
                Arquivada
              </StatusBadge>
            ) : null}
          </>
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
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={brand.archived ? "Reativar marca" : "Arquivar marca"}
        description={
          brand.archived
            ? "A marca volta a aceitar novos conteúdos."
            : "A marca deixa de aceitar novos conteúdos. O histórico continua disponível."
        }
        confirmLabel={brand.archived ? "Reativar" : "Arquivar"}
        busy={busy}
        onConfirm={async () => {
          const result = await run(
            () => setBrandArchived({ data: { id: brand.id, archived: !brand.archived } }),
            {
              success: brand.archived ? "Marca reativada." : "Marca arquivada.",
              invalidate: [QueryKey.Brands.all()],
            },
          );
          return result.ok;
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Excluir “${brand.name}”?`}
        description="Esta ação não pode ser desfeita. Só é possível excluir marcas sem canais ou histórico."
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          const result = await run(() => deleteBrand({ data: { id: brand.id } }), {
            success: "Marca excluída.",
            invalidate: [QueryKey.Brands.all()],
          });
          if (!result.ok) return false;
          queryClient.removeQueries({ queryKey: QueryKey.Brands.detail(brand.id) });
          await router.navigate({ to: AppRoute.Brands });
          return true;
        }}
      />
    </div>
  );
}
