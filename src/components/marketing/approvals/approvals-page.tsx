import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, TriangleAlert } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/shared/admin/data-table";
import { SearchableEmptyState } from "@/components/shared/admin/searchable-empty-state";
import { ListFilters } from "@/components/shared/admin/list-filters";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { useListState } from "@/hooks/shared/use-list-state";
import { type ApprovalRow, listApprovals } from "@/lib/marketing/approvals/approvals.functions";
import { ApprovalFilter } from "@/lib/marketing/approvals/schemas";
import { listBrandOptions } from "@/lib/shared/brands/brand-options.functions";
import { formatDateOnly, formatDateTime } from "@/lib/shared/format";
import { platformLabels } from "@/lib/shared/labels";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const ALL = "all";

const tabs = [
  { value: ApprovalFilter.Pending, label: "Pendentes" },
  { value: ApprovalFilter.Overdue, label: "Atrasadas" },
  { value: ApprovalFilter.Approved, label: "Aprovadas" },
  { value: ApprovalFilter.ChangesRequested, label: "Alterações solicitadas" },
  { value: ApprovalFilter.Superseded, label: "Substituídas" },
];

const ageInDays = (requestedAt: string): number =>
  Math.max(0, Math.floor((Date.now() - new Date(requestedAt).getTime()) / 86_400_000));

export function ApprovalsPage({ fixedBrandId }: { fixedBrandId?: string }) {
  const list = useListState<string>(ApprovalFilter.Pending);
  const brandId = fixedBrandId ?? list.filters.brand;
  const request = {
    search: list.debouncedSearch,
    page: list.page,
    status: list.status,
    ...(brandId ? { brandId } : {}),
  };

  const brands = useQuery({
    queryKey: QueryKey.Brands.options(),
    queryFn: async () => unwrapResult(await listBrandOptions()).brands,
    enabled: fixedBrandId === undefined,
  });
  const query = useQuery({
    queryKey: QueryKey.Approvals.list(request),
    queryFn: async () => unwrapResult(await listApprovals({ data: request })),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<ApprovalRow>[] = [
    {
      id: "title",
      label: "Conteúdo",
      cell: (row) => (
        <Link
          to="/admin/marketing/approvals/$requestId"
          params={{ requestId: row.id }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    { id: "brand", label: "Marca", cell: (row) => row.brandName },
    {
      id: "channel",
      label: "Canal",
      cell: (row) => `${platformLabels[row.platform]} · ${row.profileName}`,
    },
    { id: "revision", label: "Versão", cell: (row) => row.revisionNo },
    { id: "approver", label: "Aprovador", cell: (row) => row.approverName ?? "—" },
    { id: "requested", label: "Enviada em", cell: (row) => formatDateTime(row.requestedAt) },
    {
      id: "due",
      label: "Prazo",
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          {row.dueDate ? formatDateOnly(row.dueDate) : "—"}
          {row.overdue ? (
            <StatusBadge tone="negative" icon={TriangleAlert}>
              Atrasada
            </StatusBadge>
          ) : null}
        </span>
      ),
    },
    { id: "age", label: "Há", cell: (row) => `${ageInDays(row.requestedAt)} dia(s)` },
    { id: "status", label: "Situação", cell: (row) => <RequestStatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovações"
        description="Os pedidos enviados aos clientes e o que cada um decidiu."
        breadcrumbs={fixedBrandId ? undefined : [{ label: "Aprovações" }]}
      />
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchLabel="Buscar por conteúdo"
        statusOptions={tabs}
        status={list.status}
        onStatusChange={list.setStatus}
        extra={
          fixedBrandId === undefined ? (
            <ListFilters
              groups={[
                {
                  id: "brand",
                  label: "Marca",
                  value: brandId ?? ALL,
                  defaultValue: ALL,
                  options: [
                    { value: ALL, label: "Todas as marcas" },
                    ...(brands.data ?? []).map((brand) => ({ value: brand.id, label: brand.name })),
                  ],
                  onChange: (value) =>
                    void list.setFilter("brand", value === ALL ? undefined : value),
                },
              ]}
            />
          ) : undefined
        }
      />
      <DataTable
        caption="Aprovações"
        rows={query.data?.rows ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.title}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error?.message ?? null}
        onRetry={() => void query.refetch()}
        empty={
          <SearchableEmptyState
            icon={ClipboardCheck}
            search={list.debouncedSearch}
            onClearSearch={() => list.setSearch("")}
            emptyTitle="Nada por aqui"
            emptyDescription="Quando uma versão for enviada ao cliente, o pedido aparece aqui."
            noResultsDescription="Tente outro título."
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
