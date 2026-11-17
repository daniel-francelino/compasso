import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  CircleCheck,
  Eye,
  LayoutTemplate,
  PenTool,
  Plus,
  Scaling,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { brandSelectOptions } from "@/components/shared/admin/brand-select-options";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import {
  type DataTableAction,
  type DataTableColumn,
  DataTable,
} from "@/components/shared/admin/data-table";
import { ListFilters } from "@/components/shared/admin/list-filters";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SearchableEmptyState } from "@/components/shared/admin/searchable-empty-state";
import { NewDesignDialog } from "@/components/shared/design/new-design-dialog";
import { ResizeDesignDialog } from "@/components/shared/design/resize-design-dialog";
import { Button } from "@/components/shared/ui/button";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useListState } from "@/hooks/shared/use-list-state";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import {
  type DesignRow,
  listDesigns,
  setDesignTrashed,
} from "@/lib/shared/design/design.functions";
import {
  DESIGN_PAGE_SIZE,
  DESIGN_PRESET_LABEL,
  DesignStatusFilter,
} from "@/lib/shared/design/types";
import { formatDate } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const ALL = "all";

const emptyTitle: Record<DesignStatusFilter, string> = {
  [DesignStatusFilter.Active]: "Nenhum design ainda",
  [DesignStatusFilter.Templates]: "Nenhum modelo ainda",
  [DesignStatusFilter.Trash]: "A lixeira está vazia",
};

const emptyDescription: Record<DesignStatusFilter, string> = {
  [DesignStatusFilter.Active]: "Crie o primeiro design a partir de um formato do Instagram.",
  [DesignStatusFilter.Templates]:
    'Abra um design e ligue "Modelo da marca" para usá-lo como ponto de partida de novos designs.',
  [DesignStatusFilter.Trash]:
    "Os designs movidos para a lixeira aparecem aqui e podem ser restaurados.",
};

const tabs = [
  { value: DesignStatusFilter.Active, label: "Ativos", icon: CircleCheck },
  { value: DesignStatusFilter.Templates, label: "Modelos", icon: LayoutTemplate },
  { value: DesignStatusFilter.Trash, label: "Lixeira", icon: Trash2 },
];

export function DesignsPage() {
  const auth = useAuth();
  const router = useRouter();
  const { run, busy } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [trashing, setTrashing] = useState<DesignRow | null>(null);
  const [resizing, setResizing] = useState<DesignRow | null>(null);
  const list = useListState<string>(DesignStatusFilter.Active);
  const status =
    Object.values(DesignStatusFilter).find((value) => value === list.status) ??
    DesignStatusFilter.Active;
  const brands = useBrandOptions();
  const request = {
    search: list.debouncedSearch,
    page: list.page,
    status,
    ...(list.filters.brand ? { brandId: list.filters.brand } : {}),
  };
  const query = useQuery({
    queryKey: QueryKey.Design.list(request),
    queryFn: async () => unwrapResult(await listDesigns({ data: request })),
    placeholderData: keepPreviousData,
  });

  const open = (row: DesignRow) =>
    void router.navigate({
      to: "/admin/marketing/designs/$designId",
      params: { designId: row.id },
    });

  const columns: DataTableColumn<DesignRow>[] = [
    {
      id: "name",
      label: "Design",
      cell: (row) =>
        row.trashed ? (
          <span className="font-medium">{row.name}</span>
        ) : (
          <Link
            to="/admin/marketing/designs/$designId"
            params={{ designId: row.id }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {row.name}
          </Link>
        ),
    },
    { id: "brand", label: "Marca", cell: (row) => row.brandName },
    { id: "template", label: "Modelo", cell: (row) => (row.isTemplate ? "Sim" : "—") },
    { id: "preset", label: "Formato", cell: (row) => DESIGN_PRESET_LABEL[row.preset] },
    { id: "versions", label: "Versões salvas", cell: (row) => row.savedVersions },
    { id: "updated", label: "Última alteração", cell: (row) => formatDate(row.updatedAt) },
  ];

  const actionsFor = (row: DesignRow): DataTableAction<DesignRow>[] => [
    ...(row.trashed ? [] : [{ id: "open", label: "Abrir design", icon: Eye, onSelect: open }]),
    ...(!row.trashed && can(auth, Action.Design.Create)
      ? [{ id: "resize", label: "Redimensionar", icon: Scaling, onSelect: setResizing }]
      : []),
    ...(can(auth, Action.Design.Delete)
      ? [
          {
            id: "trash",
            label: row.trashed ? "Restaurar" : "Mover para a lixeira",
            icon: row.trashed ? Undo2 : Trash2,
            destructive: !row.trashed,
            onSelect: setTrashing,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Designs"
        description="Imagens das marcas criadas no editor: posts de feed, slides e stories."
        breadcrumbs={[{ label: "Designs" }]}
        actions={
          can(auth, Action.Design.Create) ? (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Novo design
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
                id: "brand",
                label: "Marca",
                value: list.filters.brand ?? ALL,
                defaultValue: ALL,
                emptyText: brands.data?.length === 0 ? "Nenhuma marca cadastrada" : undefined,
                options: brandSelectOptions(brands.data, "Todas as marcas", ALL),
                onChange: (value) =>
                  void list.setFilter("brand", value === ALL ? undefined : value),
              },
            ]}
          />
        }
      />
      <DataTable
        caption="Designs"
        rows={query.data?.rows ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        actionsMenu
        actions={actionsFor}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error?.message ?? null}
        onRetry={() => void query.refetch()}
        empty={
          <SearchableEmptyState
            icon={PenTool}
            search={list.debouncedSearch}
            onClearSearch={() => list.setSearch("")}
            emptyTitle={emptyTitle[status]}
            emptyDescription={emptyDescription[status]}
          />
        }
        pagination={{
          page: list.page,
          pageSize: DESIGN_PAGE_SIZE,
          total: query.data?.total ?? 0,
          onPageChange: list.setPage,
        }}
      />
      {creating ? (
        <NewDesignDialog
          open={creating}
          onOpenChange={setCreating}
          defaultBrandId={list.filters.brand}
        />
      ) : null}
      {resizing === null ? null : (
        <ResizeDesignDialog
          source={resizing}
          onOpenChange={(value) => !value && setResizing(null)}
        />
      )}
      <ConfirmDialog
        open={trashing !== null}
        onOpenChange={(value) => !value && setTrashing(null)}
        title={trashing?.trashed ? "Restaurar design" : "Mover para a lixeira"}
        description={
          trashing?.trashed
            ? `"${trashing.name}" volta para a lista de designs ativos.`
            : `"${trashing?.name ?? ""}" sai da lista e não pode ser editado até ser restaurado. Nada é apagado.`
        }
        confirmLabel={trashing?.trashed ? "Restaurar" : "Mover para a lixeira"}
        destructive={trashing?.trashed !== true}
        busy={busy}
        onConfirm={async () => {
          if (trashing === null) return false;
          const result = await run(
            () => setDesignTrashed({ data: { id: trashing.id, trashed: !trashing.trashed } }),
            {
              success: trashing.trashed ? "Design restaurado." : "Design movido para a lixeira.",
              invalidate: [QueryKey.Design.all()],
            },
          );
          if (result.ok) setTrashing(null);
          return result.ok;
        }}
      />
    </div>
  );
}
