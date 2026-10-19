import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { Archive, Building2, CircleCheck, Eye, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import {
  type DataTableAction,
  type DataTableColumn,
  DataTable,
} from "@/components/shared/admin/data-table";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { ClientForm } from "@/components/marketing/clients/client-form";
import { SearchableEmptyState } from "@/components/shared/admin/searchable-empty-state";
import { ListFilters } from "@/components/shared/admin/list-filters";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { Label } from "@/components/shared/ui/label";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useListState } from "@/hooks/shared/use-list-state";
import { TextField } from "@/components/shared/admin/form-fields";
import {
  type ClientRow,
  deleteClient,
  getClient,
  listClients,
  listOwnerOptions,
  setClientArchived,
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { run, busy } = useServerAction();
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [archivingClient, setArchivingClient] = useState<ClientRow | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientRow | null>(null);
  const [archiveBrands, setArchiveBrands] = useState(false);
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

  const selectedClient = editingClient ?? archivingClient;
  const selectedClientQuery = useQuery({
    queryKey: QueryKey.Clients.detail(selectedClient?.id ?? ""),
    queryFn: async () =>
      unwrapResult(await getClient({ data: { id: selectedClient?.id ?? "" } })).client,
    enabled: selectedClient !== null,
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

  const actionsForClient = (row: ClientRow): DataTableAction<ClientRow>[] => [
    {
      id: "open",
      label: "Abrir cliente",
      icon: Eye,
      onSelect: (client) =>
        void router.navigate({
          to: "/admin/marketing/clients/$clientId",
          params: { clientId: client.id },
        }),
    },
    ...(can(auth, Action.Clients.Update)
      ? [
          {
            id: "edit",
            label: "Editar cliente",
            icon: Pencil,
            onSelect: setEditingClient,
          },
          {
            id: "archive",
            label: row.archived ? "Reativar cliente" : "Arquivar cliente",
            icon: row.archived ? Undo2 : Archive,
            onSelect: (client: ClientRow) => {
              setArchiveBrands(false);
              setArchivingClient(client);
            },
          },
        ]
      : []),
    ...(can(auth, Action.Clients.Delete)
      ? [
          {
            id: "delete",
            label: "Excluir cliente",
            icon: Trash2,
            destructive: true,
            disabled: row.brandCount > 0,
            disabledReason:
              row.brandCount > 0 ? "Clientes com marcas não podem ser excluídos." : undefined,
            onSelect: setDeletingClient,
          },
        ]
      : []),
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
        actionsMenu
        actions={(row) => actionsForClient(row)}
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
      <Dialog
        open={editingClient !== null}
        onOpenChange={(open) => !open && setEditingClient(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Altere os dados do cliente.</DialogDescription>
          </DialogHeader>
          {selectedClientQuery.isPending ? (
            <p>Carregando cliente…</p>
          ) : selectedClientQuery.isError ? (
            <p role="alert">{selectedClientQuery.error.message}</p>
          ) : selectedClientQuery.data && editingClient ? (
            <ClientForm
              client={selectedClientQuery.data}
              onCancel={() => setEditingClient(null)}
              onSaved={() => {
                setEditingClient(null);
                void queryClient.invalidateQueries({ queryKey: QueryKey.Clients.all() });
                void queryClient.invalidateQueries({
                  queryKey: QueryKey.Clients.detail(editingClient.id),
                });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={archivingClient !== null}
        onOpenChange={(open) => !open && setArchivingClient(null)}
        title={archivingClient?.archived ? "Reativar cliente" : "Arquivar cliente"}
        description={
          <div className="space-y-3">
            <p>
              {archivingClient?.archived
                ? "O cliente volta para as listas e seletores."
                : "O cliente sai das listas e seletores. Nada é apagado."}
            </p>
            {selectedClientQuery.isPending ? <p>Carregando marcas…</p> : null}
            {!archivingClient?.archived &&
            selectedClientQuery.data?.brands.some((brand) => !brand.archived) ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="clients-list-archive-brands"
                  checked={archiveBrands}
                  onCheckedChange={(checked) => setArchiveBrands(checked === true)}
                />
                <Label htmlFor="clients-list-archive-brands">
                  Arquivar também as marcas ativas deste cliente
                </Label>
              </div>
            ) : null}
            {!archivingClient?.archived && selectedClientQuery.data ? (
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {selectedClientQuery.data.brands
                  .filter((brand) => !brand.archived)
                  .map((brand) => (
                    <li key={brand.id}>{brand.name}</li>
                  ))}
              </ul>
            ) : null}
            {selectedClientQuery.isError ? (
              <p role="alert">Não foi possível carregar as marcas do cliente.</p>
            ) : null}
          </div>
        }
        confirmLabel={archivingClient?.archived ? "Reativar" : "Arquivar"}
        busy={busy || selectedClientQuery.isPending || selectedClientQuery.isError}
        onConfirm={async () => {
          if (archivingClient === null) return false;
          const result = await run(
            () =>
              setClientArchived({
                data: {
                  id: archivingClient.id,
                  archived: !archivingClient.archived,
                  archiveBrands,
                },
              }),
            {
              success: archivingClient.archived ? "Cliente reativado." : "Cliente arquivado.",
              invalidate: [QueryKey.Clients.all()],
            },
          );
          if (result.ok) setArchivingClient(null);
          return result.ok;
        }}
      />
      <ConfirmDialog
        open={deletingClient !== null}
        onOpenChange={(open) => !open && setDeletingClient(null)}
        title="Excluir cliente"
        description="Esta ação não pode ser desfeita. Só é possível excluir clientes sem marcas."
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (deletingClient === null) return false;
          const result = await run(() => deleteClient({ data: { id: deletingClient.id } }), {
            success: "Cliente excluído.",
            invalidate: [QueryKey.Clients.all()],
          });
          if (result.ok) setDeletingClient(null);
          return result.ok;
        }}
      />
    </div>
  );
}
