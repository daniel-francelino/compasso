import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { brandSelectOptions } from "@/components/shared/admin/brand-select-options";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Ban,
  Columns3,
  Copy,
  CircleCheck,
  CircleX,
  Eye,
  FileText,
  List,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  type DataTableAction,
  type DataTableColumn,
  DataTable,
} from "@/components/shared/admin/data-table";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { IconButton } from "@/components/shared/admin/icon-button";
import { ListFilters, type FilterGroup } from "@/components/shared/admin/list-filters";
import { SearchableEmptyState } from "@/components/shared/admin/searchable-empty-state";
import { TextField } from "@/components/shared/admin/form-fields";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ReasonDialog } from "@/components/shared/admin/reason-dialog";
import { Button } from "@/components/shared/ui/button";
import { ContentBoard } from "@/components/marketing/content/content-board";
import { ChannelLogos } from "@/components/marketing/content/channel-logos";
import { EditorialStatusBadge } from "@/components/shared/content/status-badges";
import { PersonAvatar } from "@/components/shared/admin/person-avatar";
import { useAvatarUrls } from "@/hooks/shared/use-avatar-urls";
import { useListState } from "@/hooks/shared/use-list-state";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { listChannels } from "@/lib/marketing/channels/channels.functions";
import {
  type ContentItemRow,
  cancelContentItem,
  deleteContentItem,
  duplicateContentItem,
  listAssigneeOptions,
  listContentItems,
} from "@/lib/marketing/content/content.functions";
import { ContentStatusFilter } from "@/lib/marketing/content/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { EditorialStatus, PublicationStatus } from "@/lib/shared/enums";
import { formatDateOnly, formatInZone } from "@/lib/shared/format";
import {
  editorialStatusLabels,
  platformLabels,
  publicationStatusLabels,
} from "@/lib/shared/labels";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const ALL = "all";
const VIEW_BOARD = "board";

const tabs = [
  { value: ContentStatusFilter.Active, label: "Ativos", icon: CircleCheck },
  { value: ContentStatusFilter.Cancelled, label: "Cancelados", icon: CircleX },
];

const editorialOptions = [
  { value: ALL, label: "Todos os estados" },
  ...Object.values(EditorialStatus).map((value) => ({
    value,
    label: editorialStatusLabels[value],
  })),
];

const publicationOptions = [
  { value: ALL, label: "Todas as publicações" },
  ...Object.values(PublicationStatus).map((value) => ({
    value,
    label: publicationStatusLabels[value],
  })),
];

const nextPlanned = (row: ContentItemRow): { at: string; timeZone: string } | null => {
  const planned = row.channels
    .filter((variant) => variant.plannedAt !== null && variant.plannedTimezone !== null)
    .sort((a, b) => (a.plannedAt ?? "").localeCompare(b.plannedAt ?? ""))[0];
  return planned?.plannedAt && planned.plannedTimezone
    ? { at: planned.plannedAt, timeZone: planned.plannedTimezone }
    : null;
};

export function ContentPage({ fixedBrandId }: { fixedBrandId?: string }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const list = useListState<string>(ContentStatusFilter.Active);
  const [cancelling, setCancelling] = useState<ContentItemRow | null>(null);
  const [deleting, setDeleting] = useState<ContentItemRow | null>(null);
  const { run, busy } = useServerAction();
  const brandId = fixedBrandId ?? list.filters.brand;
  const board = list.filters.view === VIEW_BOARD;

  const request = {
    search: list.debouncedSearch,
    page: list.page,
    status: list.status,
    ...(brandId ? { brandId } : {}),
    ...(list.filters.channel ? { channelId: list.filters.channel } : {}),
    ...(list.filters.owner ? { ownerId: list.filters.owner } : {}),
    ...(list.filters.editorial ? { editorial: list.filters.editorial as EditorialStatus } : {}),
    ...(list.filters.publication ? { publication: list.filters.publication } : {}),
    ...(list.filters.tag ? { tag: list.filters.tag } : {}),
    ...(list.sort ? { sort: list.sort.key, dir: list.sort.dir } : {}),
  };

  const brands = useBrandOptions(fixedBrandId === undefined);
  const channels = useQuery({
    queryKey: QueryKey.Channels.list(brandId ?? "", { status: "active" }),
    queryFn: async () =>
      unwrapResult(await listChannels({ data: { brandId: brandId ?? "" } })).channels,
    enabled: brandId !== undefined && can(auth, Action.Channels.View),
  });
  const assignees = useQuery({
    queryKey: QueryKey.Content.assignees(brandId ?? ""),
    queryFn: async () =>
      unwrapResult(await listAssigneeOptions({ data: { brandId: brandId ?? "" } })).people,
    enabled: brandId !== undefined,
  });

  const query = useQuery({
    queryKey: QueryKey.Content.list(request),
    queryFn: async () => unwrapResult(await listContentItems({ data: request })),
    placeholderData: keepPreviousData,
    enabled: !board,
  });
  const avatars = useAvatarUrls([
    ...(assignees.data ?? []).map((person) => person.id),
    ...(query.data?.rows ?? []).map((row) => row.assigneeId),
  ]);
  const invalidate = [QueryKey.Content.all(), QueryKey.Dashboard.all()];

  const duplicate = async (id: string) => {
    const result = await run(() => duplicateContentItem({ data: { id } }), {
      invalidate,
      success: "Conteúdo duplicado. Ajuste o nome e as datas.",
    });
    if (!result.ok) return;
    void navigate({ to: "/admin/marketing/content/$itemId", params: { itemId: result.id } });
  };

  const columns: DataTableColumn<ContentItemRow>[] = [
    {
      id: "title",
      label: "Conteúdo",
      sortable: true,
      cell: (row) => (
        <Link
          to="/admin/marketing/content/$itemId"
          params={{ itemId: row.id }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    { id: "brand", label: "Marca", cell: (row) => row.brandName },
    {
      id: "channels",
      label: "Canais",
      cell: (row) => <ChannelLogos channels={row.channels} />,
    },
    {
      id: "status",
      label: "Estado",
      cell: (row) => <EditorialStatusBadge status={row.editorialStatus} />,
    },
    {
      id: "planned",
      label: "Prevista",
      cell: (row) => {
        const planned = nextPlanned(row);
        return planned ? (
          <span className="inline-flex items-center gap-1.5">
            {formatInZone(planned.at, planned.timeZone)}
            <InfoTip label={`Fuso horário: ${planned.timeZone}`}>
              Fuso horário: {planned.timeZone}
            </InfoTip>
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      id: "owner",
      label: "Responsável",
      cell: (row) =>
        row.assigneeId === null || row.assigneeName === null ? (
          "—"
        ) : (
          <span className="inline-flex items-center gap-2">
            <PersonAvatar name={row.assigneeName} url={avatars[row.assigneeId]} size="sm" />
            {row.assigneeName}
          </span>
        ),
    },
    {
      id: "deadline",
      label: "Prazo",
      sortable: true,
      cell: (row) => (row.productionDueDate ? formatDateOnly(row.productionDueDate) : "—"),
    },
  ];

  const actions = (row: ContentItemRow): DataTableAction<ContentItemRow>[] => [
    ...(can(auth, Action.Content.Update)
      ? [
          {
            id: "edit",
            label: "Editar",
            icon: Pencil,
            onSelect: (item: ContentItemRow) =>
              void navigate({
                to: "/admin/marketing/content/$itemId",
                params: { itemId: item.id },
              }),
          },
        ]
      : []),
    {
      id: "open",
      label: "Abrir",
      icon: Eye,
      onSelect: (item) =>
        void navigate({ to: "/admin/marketing/content/$itemId", params: { itemId: item.id } }),
    },
    ...(can(auth, Action.Content.Create)
      ? [
          {
            id: "duplicate",
            label: "Duplicar",
            icon: Copy,
            onSelect: (item: ContentItemRow) => void duplicate(item.id),
          },
        ]
      : []),
    ...(can(auth, Action.Content.Cancel) && !row.cancelled
      ? [{ id: "cancel", label: "Cancelar", icon: Ban, onSelect: setCancelling }]
      : []),
    ...(can(auth, Action.Content.Delete)
      ? [
          {
            id: "delete",
            label: "Excluir",
            icon: Trash2,
            destructive: true,
            onSelect: setDeleting,
          },
        ]
      : []),
  ];

  const filterGroups: FilterGroup[] = [
    ...(fixedBrandId === undefined
      ? [
          {
            id: "brand",
            label: "Marca",
            value: list.filters.brand ?? ALL,
            defaultValue: ALL,
            emptyText: brands.data?.length === 0 ? "Nenhuma marca cadastrada" : undefined,
            options: brandSelectOptions(brands.data, "Todas as marcas", ALL),
            onChange: (value: string) => {
              void list.setFilter("brand", value === ALL ? undefined : value);
              void list.setFilter("channel", undefined);
              void list.setFilter("owner", undefined);
            },
          },
        ]
      : []),
    {
      id: "channel",
      label: "Canal",
      value: list.filters.channel ?? ALL,
      defaultValue: ALL,
      emptyText:
        brandId === undefined
          ? "Escolha uma marca para filtrar por canal"
          : channels.data?.length === 0
            ? "Nenhum canal ativo nesta marca"
            : undefined,
      options: [
        { value: ALL, label: brandId === undefined ? "Escolha uma marca" : "Todos os canais" },
        ...(channels.data ?? []).map((channel) => ({
          value: channel.id,
          label: `${platformLabels[channel.platform]} · ${channel.profileName}`,
        })),
      ],
      onChange: (value) => void list.setFilter("channel", value === ALL ? undefined : value),
    },
    {
      id: "owner",
      label: "Responsável",
      value: list.filters.owner ?? ALL,
      defaultValue: ALL,
      emptyText:
        brandId === undefined
          ? "Escolha uma marca para filtrar por responsável"
          : assignees.data?.length === 0
            ? "Nenhuma pessoa disponível"
            : undefined,
      options: [
        { value: ALL, label: brandId === undefined ? "Escolha uma marca" : "Todos" },
        ...(assignees.data ?? []).map((person) => ({
          value: person.id,
          label: person.name,
          icon: <PersonAvatar name={person.name} url={avatars[person.id]} size="md" />,
        })),
      ],
      onChange: (value) => void list.setFilter("owner", value === ALL ? undefined : value),
    },
    ...(board
      ? []
      : [
          {
            id: "editorial",
            label: "Estado",
            value: list.filters.editorial ?? ALL,
            defaultValue: ALL,
            options: editorialOptions,
            onChange: (value: string) =>
              void list.setFilter("editorial", value === ALL ? undefined : value),
          },
          {
            id: "publication",
            label: "Publicação",
            value: list.filters.publication ?? ALL,
            defaultValue: ALL,
            options: publicationOptions,
            onChange: (value: string) =>
              void list.setFilter("publication", value === ALL ? undefined : value),
          },
        ]),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="Conteúdos"
        description="Cada conteúdo, os canais onde vai sair e o estado de aprovação."
        breadcrumbs={fixedBrandId ? undefined : [{ label: "Conteúdos" }]}
        actions={
          can(auth, Action.Content.Create) ? (
            <Button
              onClick={() =>
                void navigate({
                  to: "/admin/marketing/content/new",
                  search: fixedBrandId ? { brand: fixedBrandId } : {},
                })
              }
            >
              <Plus aria-hidden="true" />
              Novo conteúdo
            </Button>
          ) : null
        }
      />
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchLabel="Buscar por título"
        {...(board
          ? {}
          : { statusOptions: tabs, status: list.status, onStatusChange: list.setStatus })}
        extra={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <ListFilters
              groups={filterGroups}
              extraActive={
                (list.filters.tag ? 1 : 0) +
                (board && list.filters.editorial ? 1 : 0) +
                (board && list.filters.publication ? 1 : 0)
              }
              onClear={() => {
                void list.setFilter("tag", undefined);
                if (board) {
                  void list.setFilter("editorial", undefined);
                  void list.setFilter("publication", undefined);
                }
              }}
            >
              {board ? null : (
                <TextField
                  id="content-tag"
                  label="Etiqueta"
                  value={list.filters.tag ?? ""}
                  onValueChange={(value) => void list.setFilter("tag", value)}
                  maxLength={40}
                />
              )}
            </ListFilters>
            <IconButton
              variant="outline"
              label={board ? "Alternar para lista" : "Alternar para quadro"}
              icon={board ? List : Columns3}
              onClick={() => void list.setFilter("view", board ? undefined : VIEW_BOARD)}
            />
          </div>
        }
      />
      {board ? (
        <ContentBoard
          filters={{
            search: list.debouncedSearch,
            ...(brandId ? { brandId } : {}),
            ...(list.filters.channel ? { channelId: list.filters.channel } : {}),
            ...(list.filters.owner ? { ownerId: list.filters.owner } : {}),
          }}
        />
      ) : (
        <DataTable
          caption="Conteúdos"
          rows={query.data?.rows ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          rowLabel={(row) => row.title}
          actionsMenu
          actions={actions}
          sort={{ current: list.sort, onToggle: list.toggleSort }}
          loading={query.isPending}
          refreshing={query.isFetching}
          error={query.error?.message ?? null}
          onRetry={() => void query.refetch()}
          empty={
            <SearchableEmptyState
              icon={FileText}
              search={list.debouncedSearch}
              onClearSearch={() => list.setSearch("")}
              emptyTitle="Nenhum conteúdo ainda"
              emptyDescription="Crie o primeiro conteúdo para começar a planejar as publicações."
              noResultsDescription="Tente outro título ou limpe os filtros."
            />
          }
          pagination={{
            page: list.page,
            pageSize: PAGE_SIZE,
            total: query.data?.total ?? 0,
            onPageChange: list.setPage,
          }}
        />
      )}
      <ReasonDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={`Cancelar “${cancelling?.title ?? ""}”?`}
        description="Os canais ainda não publicados serão cancelados e os pedidos pendentes ao cliente também. O histórico é mantido."
        confirmLabel="Cancelar conteúdo"
        onSubmit={async (reason) => {
          if (cancelling === null) return false;
          const result = await run(
            () => cancelContentItem({ data: { id: cancelling.id, reason } }),
            { invalidate, success: "Conteúdo cancelado." },
          );
          return result.ok ? null : result.message;
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Excluir “${deleting?.title ?? ""}”?`}
        description="Só é possível excluir conteúdos que nunca foram enviados para aprovação nem receberam comentários. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (deleting === null) return false;
          const result = await run(() => deleteContentItem({ data: { id: deleting.id } }), {
            invalidate,
            success: "Conteúdo excluído.",
          });
          return result.ok;
        }}
      />
    </div>
  );
}
