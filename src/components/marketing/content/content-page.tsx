import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { type DataTableColumn, DataTable } from "@/components/shared/admin/data-table";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { ContentBoard } from "@/components/marketing/content/content-board";
import { ItemFormDialog } from "@/components/marketing/content/item-form-dialog";
import { EditorialStatusBadge } from "@/components/shared/content/status-badges";
import { useListState } from "@/hooks/shared/use-list-state";
import { listChannels } from "@/lib/marketing/channels/channels.functions";
import {
  type ContentItemRow,
  listAssigneeOptions,
  listContentItems,
} from "@/lib/marketing/content/content.functions";
import { ContentStatusFilter } from "@/lib/marketing/content/schemas";
import { listBrandOptions } from "@/lib/shared/brands/brand-options.functions";
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
const VIEW_LIST = "list";

const tabs = [
  { value: ContentStatusFilter.Active, label: "Ativos" },
  { value: ContentStatusFilter.Cancelled, label: "Cancelados" },
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

const nextPlanned = (row: ContentItemRow): string => {
  const planned = row.variants
    .filter((variant) => variant.plannedAt !== null && variant.plannedTimezone !== null)
    .sort((a, b) => (a.plannedAt ?? "").localeCompare(b.plannedAt ?? ""))[0];
  return planned?.plannedAt && planned.plannedTimezone
    ? formatInZone(planned.plannedAt, planned.plannedTimezone)
    : "—";
};

export function ContentPage({ fixedBrandId }: { fixedBrandId?: string }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const list = useListState<string>(ContentStatusFilter.Active);
  const [creating, setCreating] = useState(false);
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

  const brands = useQuery({
    queryKey: QueryKey.Brands.options(),
    queryFn: async () => unwrapResult(await listBrandOptions()).brands,
    enabled: fixedBrandId === undefined,
  });
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
      cell: (row) =>
        row.variants.length === 0
          ? "—"
          : [...new Set(row.variants.map((variant) => platformLabels[variant.platform]))].join(
              ", ",
            ),
    },
    {
      id: "status",
      label: "Estados",
      cell: (row) =>
        row.variants.length === 0 ? (
          "Sem variantes"
        ) : (
          <span className="flex flex-wrap gap-1">
            {[...new Set(row.variants.map((variant) => variant.editorialStatus))].map((status) => (
              <EditorialStatusBadge key={status} status={status} />
            ))}
          </span>
        ),
    },
    { id: "planned", label: "Prevista", cell: nextPlanned },
    { id: "owner", label: "Responsável", cell: (row) => row.assigneeName ?? "—" },
    {
      id: "deadline",
      label: "Prazo",
      sortable: true,
      cell: (row) => (row.productionDueDate ? formatDateOnly(row.productionDueDate) : "—"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conteúdos"
        description="As ideias de conteúdo e suas variantes por canal."
        breadcrumbs={fixedBrandId ? undefined : [{ label: "Conteúdos" }]}
        actions={
          can(auth, Action.Content.Create) ? (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Novo conteúdo
            </Button>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={board ? VIEW_BOARD : VIEW_LIST}
          onValueChange={(value) =>
            void list.setFilter("view", value === VIEW_BOARD ? VIEW_BOARD : undefined)
          }
        >
          <TabsList>
            <TabsTrigger value={VIEW_LIST}>Lista</TabsTrigger>
            <TabsTrigger value={VIEW_BOARD}>Quadro</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchLabel="Buscar por título"
        {...(board
          ? {}
          : { statusOptions: tabs, status: list.status, onStatusChange: list.setStatus })}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fixedBrandId === undefined ? (
          <SelectField
            id="content-brand"
            label="Marca"
            value={brandId ?? ALL}
            onValueChange={(value) => {
              void list.setFilter("brand", value === ALL ? undefined : value);
              void list.setFilter("channel", undefined);
              void list.setFilter("owner", undefined);
            }}
            options={[
              { value: ALL, label: "Todas as marcas" },
              ...(brands.data ?? []).map((brand) => ({ value: brand.id, label: brand.name })),
            ]}
          />
        ) : null}
        <SelectField
          id="content-channel"
          label="Canal"
          value={list.filters.channel ?? ALL}
          disabled={brandId === undefined}
          onValueChange={(value) =>
            void list.setFilter("channel", value === ALL ? undefined : value)
          }
          options={[
            { value: ALL, label: brandId === undefined ? "Escolha uma marca" : "Todos os canais" },
            ...(channels.data ?? []).map((channel) => ({
              value: channel.id,
              label: `${platformLabels[channel.platform]} · ${channel.profileName}`,
            })),
          ]}
        />
        <SelectField
          id="content-owner"
          label="Responsável"
          value={list.filters.owner ?? ALL}
          disabled={brandId === undefined}
          onValueChange={(value) => void list.setFilter("owner", value === ALL ? undefined : value)}
          options={[
            { value: ALL, label: brandId === undefined ? "Escolha uma marca" : "Todos" },
            ...(assignees.data ?? []).map((person) => ({ value: person.id, label: person.name })),
          ]}
        />
        {board ? null : (
          <>
            <SelectField
              id="content-editorial"
              label="Estado"
              value={list.filters.editorial ?? ALL}
              onValueChange={(value) =>
                void list.setFilter("editorial", value === ALL ? undefined : value)
              }
              options={editorialOptions}
            />
            <SelectField
              id="content-publication"
              label="Publicação"
              value={list.filters.publication ?? ALL}
              onValueChange={(value) =>
                void list.setFilter("publication", value === ALL ? undefined : value)
              }
              options={publicationOptions}
            />
            <TextField
              id="content-tag"
              label="Etiqueta"
              value={list.filters.tag ?? ""}
              onValueChange={(value) => void list.setFilter("tag", value)}
              maxLength={40}
            />
          </>
        )}
      </div>
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
          sort={{ current: list.sort, onToggle: list.toggleSort }}
          loading={query.isPending}
          refreshing={query.isFetching}
          error={query.error?.message ?? null}
          onRetry={() => void query.refetch()}
          empty={
            <EmptyState
              icon={FileText}
              title={list.debouncedSearch ? "Nenhum conteúdo encontrado" : "Nenhum conteúdo ainda"}
              description={
                list.debouncedSearch
                  ? "Tente outro título ou limpe os filtros."
                  : "Crie o primeiro conteúdo para começar a planejar as publicações."
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
      )}
      {creating ? (
        <ItemFormDialog
          open
          fixedBrandId={fixedBrandId}
          onOpenChange={(next) => !next && setCreating(false)}
          onSaved={(saved) =>
            void navigate({ to: "/admin/marketing/content/$itemId", params: { itemId: saved.id } })
          }
        />
      ) : null}
    </div>
  );
}
