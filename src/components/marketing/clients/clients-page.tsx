import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Archive, Building2, CircleCheck, Plus } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/shared/admin/data-table";
import { SearchableEmptyState } from "@/components/shared/admin/searchable-empty-state";
import { ListFilters } from "@/components/shared/admin/list-filters";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { useListState } from "@/hooks/shared/use-list-state";
import { TextField } from "@/components/shared/admin/form-fields";
import {
  type ClientRow,
  listClients,
  listOwnerOptions,
} from "@/lib/marketing/clients/clients.functions";
import { ClientStatusFilter } from "@/lib/marketing/clients/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { formatDate } from "@/lib/shared/format";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const ALL = "all";

const tabs = [
  { value: ClientStatusFilter.Active, label: "Ativos", icon: CircleCheck },
  { value: ClientStatusFilter.Archived, label: "Arquivados", icon: Archive },
];

export function ClientsPage() {
  const auth = useAuth();
  const list = useListState<string>(ClientStatusFilter.Active);
  const request = {
    search: list.debouncedSearch,
    page: list.page,
    status: list.status,
    ...(list.filters.owner ? { ownerId: list.filters.owner } : {}),
    ...(list.filters.tag ? { tag: list.filters.tag } : {}),
  };
  const owners = useQuery({
    queryKey: QueryKey.Clients.owners(),
    queryFn: async () => unwrapResult(await listOwnerOptions()).people,
  });

  const query = useQuery({
    queryKey: QueryKey.Clients.list(request),
    queryFn: async () => unwrapResult(await listClients({ data: request })),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<ClientRow>[] = [
    {
      id: "name",
      label: "Cliente",
      cell: (row) => (
        <Link
          to="/admin/marketing/clients/$clientId"
          params={{ clientId: row.id }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    { id: "owner", label: "Responsável", cell: (row) => row.ownerName ?? "—" },
    { id: "brands", label: "Marcas", cell: (row) => row.brandCount },
    { id: "contacts", label: "Contatos", cell: (row) => row.contactCount },
    {
      id: "status",
      label: "Situação",
      cell: (row) => (
        <StatusBadge
          tone={row.archived ? "neutral" : "success"}
          icon={row.archived ? Archive : CircleCheck}
        >
          {row.archived ? "Arquivado" : "Ativo"}
        </StatusBadge>
      ),
    },
    { id: "updated", label: "Atualizado em", cell: (row) => formatDate(row.updatedAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="As empresas que você atende. Cada cliente tem uma ou mais marcas."
        breadcrumbs={[{ label: "Clientes" }]}
        actions={
          can(auth, Action.Clients.Create) ? (
            <Button asChild>
              <Link to={`${AppRoute.Clients}/new`}>
                <Plus aria-hidden="true" />
                Novo cliente
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
                id: "owner",
                label: "Responsável",
                value: list.filters.owner ?? ALL,
                defaultValue: ALL,
                emptyText: owners.data?.length === 0 ? "Nenhuma pessoa disponível" : undefined,
                options: [
                  { value: ALL, label: "Todos" },
                  ...(owners.data ?? []).map((person) => ({
                    value: person.id,
                    label: person.name,
                  })),
                ],
                onChange: (value) =>
                  void list.setFilter("owner", value === ALL ? undefined : value),
              },
            ]}
            extraActive={list.filters.tag ? 1 : 0}
            onClear={() => void list.setFilter("tag", undefined)}
          >
            <TextField
              id="clients-tag"
              label="Etiqueta"
              value={list.filters.tag ?? ""}
              onValueChange={(value) => void list.setFilter("tag", value)}
              maxLength={40}
            />
          </ListFilters>
        }
      />
      <DataTable
        caption="Clientes"
        rows={query.data?.rows ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error?.message ?? null}
        onRetry={() => void query.refetch()}
        empty={
          <SearchableEmptyState
            icon={Building2}
            search={list.debouncedSearch}
            onClearSearch={() => list.setSearch("")}
            emptyTitle="Nenhum cliente ainda"
            emptyDescription="Cadastre o primeiro cliente para começar a organizar as marcas."
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
