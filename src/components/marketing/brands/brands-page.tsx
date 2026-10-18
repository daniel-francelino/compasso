import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Archive, CircleCheck, Plus, Tag } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/shared/admin/data-table";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { useListState } from "@/hooks/shared/use-list-state";
import { SelectField } from "@/components/shared/admin/form-fields";
import { type BrandRow, listBrands } from "@/lib/marketing/brands/brands.functions";
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
  { value: BrandStatusFilter.Active, label: "Ativas" },
  { value: BrandStatusFilter.Archived, label: "Arquivadas" },
];

export function BrandsPage() {
  const auth = useAuth();
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
    queryFn: async () => unwrapResult(await listClients({ data: CLIENT_OPTIONS })).rows,
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
        <Link
          to="/admin/marketing/brands/$brandId"
          params={{ brandId: row.id }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
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
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id="brands-client"
          label="Cliente"
          value={list.filters.client ?? ALL}
          onValueChange={(value) =>
            void list.setFilter("client", value === ALL ? undefined : value)
          }
          options={[
            { value: ALL, label: "Todos" },
            ...(clients.data ?? []).map((client) => ({ value: client.id, label: client.name })),
          ]}
        />
        <SelectField
          id="brands-platform"
          label="Plataforma"
          value={list.filters.platform ?? ALL}
          onValueChange={(value) =>
            void list.setFilter("platform", value === ALL ? undefined : value)
          }
          options={[
            { value: ALL, label: "Todas" },
            ...Object.values(Platform).map((platform) => ({
              value: platform,
              label: platformLabels[platform],
            })),
          ]}
        />
      </div>
      <DataTable
        caption="Marcas"
        rows={query.data?.rows ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error?.message ?? null}
        onRetry={() => void query.refetch()}
        empty={
          <EmptyState
            icon={Tag}
            title={list.debouncedSearch ? "Nenhuma marca encontrada" : "Nenhuma marca ainda"}
            description={
              list.debouncedSearch ? "Tente outro nome." : "Crie a primeira marca de um cliente."
            }
          />
        }
        pagination={{
          page: list.page,
          pageSize: PAGE_SIZE,
          total: query.data?.total ?? 0,
          onPageChange: list.setPage,
        }}
      />
    </div>
  );
}
