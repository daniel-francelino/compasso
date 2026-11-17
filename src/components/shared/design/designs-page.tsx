import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
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
import { ListFilters } from "@/components/shared/admin/list-filters";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SearchableEmptyState } from "@/components/shared/admin/searchable-empty-state";
import type { DesignCardAction } from "@/components/shared/design/design-card";
import { DesignCardGrid } from "@/components/shared/design/design-card-grid";
import { DesignGalleryHero } from "@/components/shared/design/design-gallery-hero";
import { DesignQuickCreate } from "@/components/shared/design/design-quick-create";
import { NewDesignDialog } from "@/components/shared/design/new-design-dialog";
import { ResizeDesignDialog } from "@/components/shared/design/resize-design-dialog";
import { Button } from "@/components/shared/ui/button";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { useListState } from "@/hooks/shared/use-list-state";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import {
  type DesignRow,
  listDesigns,
  setDesignTrashed,
} from "@/lib/shared/design/design.functions";
import { DESIGN_PAGE_SIZE, DesignPreset, DesignStatusFilter } from "@/lib/shared/design/types";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const ALL = "all";

const gridTitle: Record<DesignStatusFilter, string> = {
  [DesignStatusFilter.Active]: "Continue criando",
  [DesignStatusFilter.Templates]: "Modelos da marca",
  [DesignStatusFilter.Trash]: "Lixeira",
};

const emptyTitle: Record<DesignStatusFilter, string> = {
  [DesignStatusFilter.Active]: "Nenhum design ainda",
  [DesignStatusFilter.Templates]: "Nenhum modelo ainda",
  [DesignStatusFilter.Trash]: "A lixeira está vazia",
};

const emptyDescription: Record<DesignStatusFilter, string> = {
  [DesignStatusFilter.Active]: "Crie o primeiro design escolhendo um formato do Instagram acima.",
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
  const [creating, setCreating] = useState<DesignPreset | null>(null);
  const [trashing, setTrashing] = useState<DesignRow | null>(null);
  const [resizing, setResizing] = useState<DesignRow | null>(null);
  const list = useListState<string>(DesignStatusFilter.Active);
  const status =
    Object.values(DesignStatusFilter).find((value) => value === list.status) ??
    DesignStatusFilter.Active;
  const brands = useBrandOptions();
  const canCreate = can(auth, Action.Design.Create);
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
  const rows = query.data?.rows ?? [];
  const thumbs = useSignedUrls(
    rows.flatMap((row) => (row.thumbVersionId === null ? [] : [row.thumbVersionId])),
    MediaVariant.Thumb,
  );

  const open = (row: DesignRow) =>
    void router.navigate({
      to: "/admin/marketing/designs/$designId",
      params: { designId: row.id },
    });

  const actionsFor = (row: DesignRow): DesignCardAction[] => [
    ...(row.trashed ? [] : [{ id: "open", label: "Abrir design", icon: Eye, onSelect: open }]),
    ...(!row.trashed && canCreate
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
    <div className="space-y-8">
      <PageHeader
        title="Designs"
        description="Imagens das marcas criadas no editor: posts de feed, slides e stories."
        breadcrumbs={[{ label: "Designs" }]}
        actions={
          canCreate ? (
            <Button onClick={() => setCreating(DesignPreset.FeedPortrait)}>
              <Plus aria-hidden="true" />
              Novo design
            </Button>
          ) : null
        }
      />
      <DesignGalleryHero
        tabs={tabs}
        status={status}
        onStatusChange={list.setStatus}
        search={list.search}
        onSearchChange={list.setSearch}
        filters={
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
      >
        <DesignQuickCreate
          canCreate={canCreate}
          onCreate={setCreating}
          onTemplates={() => list.setStatus(DesignStatusFilter.Templates)}
        />
      </DesignGalleryHero>
      <DesignCardGrid
        title={gridTitle[status]}
        rows={rows}
        total={query.data?.total ?? 0}
        page={list.page}
        pageSize={DESIGN_PAGE_SIZE}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error?.message ?? null}
        onRetry={() => void query.refetch()}
        onPageChange={list.setPage}
        thumbUrls={thumbs.data}
        actionsFor={actionsFor}
        empty={
          <SearchableEmptyState
            icon={PenTool}
            search={list.debouncedSearch}
            onClearSearch={() => list.setSearch("")}
            emptyTitle={emptyTitle[status]}
            emptyDescription={emptyDescription[status]}
          />
        }
      />
      {creating === null ? null : (
        <NewDesignDialog
          open
          onOpenChange={(value) => !value && setCreating(null)}
          defaultBrandId={list.filters.brand}
          defaultPreset={creating}
        />
      )}
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
