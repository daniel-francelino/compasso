import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BrandAvatar } from "@/components/shared/admin/brand-avatar";
import { Link, useNavigate } from "@tanstack/react-router";
import { Archive, CircleCheck, Eye, Pencil, Plus, Tag, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import {
  type DataTableAction,
  type DataTableColumn,
  DataTable,
} from "@/components/shared/admin/data-table";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { SearchableEmptyState } from "@/components/shared/admin/searchable-empty-state";
import { ListFilters } from "@/components/shared/admin/list-filters";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useListState } from "@/hooks/shared/use-list-state";
import {
  type BrandRow,
  deleteBrand,
  listBrands,
  setBrandArchived,
} from "@/lib/marketing/brands/brands.functions";
import { listClients } from "@/lib/marketing/clients/clients.functions";
import { Platform } from "@/lib/shared/enums";
import { platformLabels } from "@/lib/shared/labels";
import { BrandStatusFilter } from "@/lib/marketing/brands/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const ALL = "all";
const CLIENT_OPTIONS = { search: "", page: 1, status: "active" } as const;

const isPlatform = (value: string | undefined): value is Platform =>
  Object.values(Platform).some((platform) => platform === value);

const tabs = [
  { value: BrandStatusFilter.Active, label: "Ativas", icon: CircleCheck },
  { value: BrandStatusFilter.Archived, label: "Arquivadas", icon: Archive },
];

export function BrandsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { run, busy } = useServerAction();
  const [archiving, setArchiving] = useState<BrandRow | null>(null);
  const [deleting, setDeleting] = useState<BrandRow | null>(null);
  const list = useListState<string>(BrandStatusFilter.Active);
  const request = {
    search: list.debouncedSearch,
    page: list.page,
    status: list.status,
    ...(list.filters.client ? { clientId: list.filters.client } : {}),
    ...(isPlatform(list.filters.platform) ? { platform: list.filters.platform } : {}),
  };
  const clients = useQuery({
    queryKey: QueryKey.Clients.list(CLIENT_OPTIONS),
    queryFn: async () => unwrapResult(await listClients({ data: CLIENT_OPTIONS })),
  });

  const query = useQuery({
    queryKey: QueryKey.Brands.list(request),
    queryFn: async () => unwrapResult(await listBrands({ data: request })),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<BrandRow>[] = [
    {
      id: "name",
      label: "Marca",
      cell: (row) => (
        <span className="flex items-center gap-2">
          <BrandAvatar name={row.name} logoUrl={row.logoUrl} size="sm" />
          <Link
            to="/admin/marketing/brands/$brandId"
            params={{ brandId: row.id }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {row.name}
          </Link>
        </span>
      ),
    },
    { id: "client", label: "Cliente", cell: (row) => row.clientName },
    { id: "channels", label: "Canais", cell: (row) => row.channelCount },
    { id: "timezone", label: "Fuso horário", cell: (row) => row.timezone.replaceAll("_", " ") },
    {
      id: "status",
      label: "Situação",
      cell: (row) => (
        <StatusBadge
          tone={row.archived ? "neutral" : "success"}
          icon={row.archived ? Archive : CircleCheck}
        >
          {row.archived ? "Arquivada" : "Ativa"}
        </StatusBadge>
      ),
    },
  ];

  const actions = (row: BrandRow): DataTableAction<BrandRow>[] => [
    {
      id: "open",
      label: "Abrir marca",
      icon: Eye,
      onSelect: (brand) =>
        void navigate({ to: "/admin/marketing/brands/$brandId", params: { brandId: brand.id } }),
    },
    ...(can(auth, Action.Brands.Update)
      ? [
          {
            id: "edit",
            label: "Editar marca",
            icon: Pencil,
            onSelect: (brand: BrandRow) =>
              void navigate({
                to: "/admin/marketing/brands/$brandId/settings",
                params: { brandId: brand.id },
              }),
          },
          {
            id: "archive",
            label: row.archived ? "Reativar marca" : "Arquivar marca",
            icon: row.archived ? Undo2 : Archive,
            onSelect: setArchiving,
          },
        ]
      : []),
    ...(can(auth, Action.Brands.Delete)
      ? [
          {
            id: "delete",
            label: "Excluir marca",
            icon: Trash2,
            destructive: true,
            disabled: row.channelCount > 0,
            disabledReason:
              row.channelCount > 0 ? "Marcas com canais não podem ser excluídas." : undefined,
            onSelect: setDeleting,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marcas"
        description="Cada marca tem seus canais, conteúdos e pessoas. Quem não está ligado a uma marca não a enxerga."
        breadcrumbs={[{ label: "Marcas" }]}
        actions={
          can(auth, Action.Brands.Create) ? (
            <Button asChild>
              <Link to="/admin/marketing/brands/new">
                <Plus aria-hidden="true" />
                Nova marca
              </Link>
            </Button>
          ) : null
        }
      />
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchLabel="Buscar por nome"
        statusOptions={tabs}
        status={list.status}
        onStatusChange={list.setStatus}
        extra={
          <ListFilters
            groups={[
              {
                id: "client",
                label: "Cliente",
                value: list.filters.client ?? ALL,
                defaultValue: ALL,
                emptyText:
                  clients.data?.rows.length === 0 ? "Nenhum cliente cadastrado" : undefined,
                options: [
                  { value: ALL, label: "Todos" },
                  ...(clients.data?.rows ?? []).map((client) => ({
                    value: client.id,
                    label: client.name,
                  })),
                ],
                onChange: (value) =>
                  void list.setFilter("client", value === ALL ? undefined : value),
              },
              {
                id: "platform",
                label: "Plataforma",
                value: list.filters.platform ?? ALL,
                defaultValue: ALL,
                options: [
                  { value: ALL, label: "Todas" },
                  ...Object.values(Platform).map((platform) => ({
                    value: platform,
                    label: platformLabels[platform],
                  })),
                ],
                onChange: (value) =>
                  void list.setFilter("platform", value === ALL ? undefined : value),
              },
            ]}
          />
        }
      />
      <DataTable
        caption="Marcas"
        rows={query.data?.rows ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        actionsMenu
        actions={actions}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error?.message ?? null}
        onRetry={() => void query.refetch()}
        empty={
          <SearchableEmptyState
            icon={Tag}
            search={list.debouncedSearch}
            onClearSearch={() => list.setSearch("")}
            emptyTitle="Nenhuma marca ainda"
            emptyDescription="Crie a primeira marca de um cliente."
          />
        }
        pagination={{
          page: list.page,
          pageSize: PAGE_SIZE,
          total: query.data?.total ?? 0,
          onPageChange: list.setPage,
        }}
      />
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={archiving?.archived ? "Reativar marca" : "Arquivar marca"}
        description={
          archiving?.archived
            ? "A marca volta a aceitar novos conteúdos."
            : "A marca deixa de aceitar novos conteúdos. O histórico continua disponível."
        }
        confirmLabel={archiving?.archived ? "Reativar" : "Arquivar"}
        busy={busy}
        onConfirm={async () => {
          if (archiving === null) return false;
          const result = await run(
            () => setBrandArchived({ data: { id: archiving.id, archived: !archiving.archived } }),
            {
              success: archiving.archived ? "Marca reativada." : "Marca arquivada.",
              invalidate: [QueryKey.Brands.all()],
            },
          );
          return result.ok;
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir “${deleting?.name ?? ""}”?`}
        description="Esta ação não pode ser desfeita. Só é possível excluir marcas sem canais ou histórico."
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (deleting === null) return false;
          const result = await run(() => deleteBrand({ data: { id: deleting.id } }), {
            success: "Marca excluída.",
            invalidate: [QueryKey.Brands.all()],
          });
          return result.ok;
        }}
      />
    </div>
  );
}
