import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { CircleCheck, Clapperboard, Eye, Plus, Trash2, Undo2 } from "lucide-react";
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
import { NewVideoDialog } from "@/components/shared/video/new-video-dialog";
import { Button } from "@/components/shared/ui/button";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useListState } from "@/hooks/shared/use-list-state";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { DESIGN_PRESET_LABEL } from "@/lib/shared/design/types";
import { formatDate } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { VIDEO_PAGE_SIZE, VideoStatusFilter } from "@/lib/shared/video/types";
import {
  type VideoProjectRow,
  listVideoProjects,
  setVideoProjectTrashed,
} from "@/lib/shared/video/video.functions";

const ALL = "all";

const emptyTitle: Record<VideoStatusFilter, string> = {
  [VideoStatusFilter.Active]: "Nenhum vídeo ainda",
  [VideoStatusFilter.Trash]: "A lixeira está vazia",
};

const emptyDescription: Record<VideoStatusFilter, string> = {
  [VideoStatusFilter.Active]:
    "Crie o primeiro vídeo juntando clipes, imagens, textos e música da biblioteca.",
  [VideoStatusFilter.Trash]:
    "Os vídeos movidos para a lixeira aparecem aqui e podem ser restaurados.",
};

const tabs = [
  { value: VideoStatusFilter.Active, label: "Ativos", icon: CircleCheck },
  { value: VideoStatusFilter.Trash, label: "Lixeira", icon: Trash2 },
];

export function VideosPage() {
  const auth = useAuth();
  const router = useRouter();
  const { run, busy } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [trashing, setTrashing] = useState<VideoProjectRow | null>(null);
  const list = useListState<string>(VideoStatusFilter.Active);
  const status =
    Object.values(VideoStatusFilter).find((value) => value === list.status) ??
    VideoStatusFilter.Active;
  const brands = useBrandOptions();
  const request = {
    search: list.debouncedSearch,
    page: list.page,
    status,
    ...(list.filters.brand ? { brandId: list.filters.brand } : {}),
  };
  const query = useQuery({
    queryKey: QueryKey.Video.list(request),
    queryFn: async () => unwrapResult(await listVideoProjects({ data: request })),
    placeholderData: keepPreviousData,
  });

  const open = (row: VideoProjectRow) =>
    void router.navigate({
      to: "/admin/marketing/videos/$projectId",
      params: { projectId: row.id },
    });

  const columns: DataTableColumn<VideoProjectRow>[] = [
    {
      id: "name",
      label: "Vídeo",
      cell: (row) =>
        row.trashed ? (
          <span className="font-medium">{row.name}</span>
        ) : (
          <Link
            to="/admin/marketing/videos/$projectId"
            params={{ projectId: row.id }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {row.name}
          </Link>
        ),
    },
    { id: "brand", label: "Marca", cell: (row) => row.brandName },
    { id: "preset", label: "Formato", cell: (row) => DESIGN_PRESET_LABEL[row.preset] },
    { id: "versions", label: "Versões salvas", cell: (row) => row.savedVersions },
    { id: "updated", label: "Última alteração", cell: (row) => formatDate(row.updatedAt) },
  ];

  const actionsFor = (row: VideoProjectRow): DataTableAction<VideoProjectRow>[] => [
    ...(row.trashed ? [] : [{ id: "open", label: "Abrir vídeo", icon: Eye, onSelect: open }]),
    ...(can(auth, Action.Video.Delete)
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
        title="Vídeos"
        description="Vídeos curtos das marcas montados no editor: Reels, Stories e vídeos de feed."
        breadcrumbs={[{ label: "Vídeos" }]}
        actions={
          can(auth, Action.Video.Create) ? (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Novo vídeo
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
        caption="Vídeos"
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
            icon={Clapperboard}
            search={list.debouncedSearch}
            onClearSearch={() => list.setSearch("")}
            emptyTitle={emptyTitle[status]}
            emptyDescription={emptyDescription[status]}
          />
        }
        pagination={{
          page: list.page,
          pageSize: VIDEO_PAGE_SIZE,
          total: query.data?.total ?? 0,
          onPageChange: list.setPage,
        }}
      />
      {creating ? (
        <NewVideoDialog
          open={creating}
          onOpenChange={setCreating}
          defaultBrandId={list.filters.brand}
        />
      ) : null}
      <ConfirmDialog
        open={trashing !== null}
        onOpenChange={(value) => !value && setTrashing(null)}
        title={trashing?.trashed ? "Restaurar vídeo" : "Mover para a lixeira"}
        description={
          trashing?.trashed
            ? `"${trashing.name}" volta para a lista de vídeos ativos.`
            : `"${trashing?.name ?? ""}" sai da lista e não pode ser editado até ser restaurado. Nada é apagado, e os vídeos já exportados continuam na biblioteca.`
        }
        confirmLabel={trashing?.trashed ? "Restaurar" : "Mover para a lixeira"}
        destructive={trashing?.trashed !== true}
        busy={busy}
        onConfirm={async () => {
          if (trashing === null) return false;
          const result = await run(
            () => setVideoProjectTrashed({ data: { id: trashing.id, trashed: !trashing.trashed } }),
            {
              success: trashing.trashed ? "Vídeo restaurado." : "Vídeo movido para a lixeira.",
              invalidate: [QueryKey.Video.all()],
            },
          );
          if (result.ok) setTrashing(null);
          return result.ok;
        }}
      />
    </div>
  );
}
