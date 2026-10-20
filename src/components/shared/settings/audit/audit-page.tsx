import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Download, ScrollText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type DataTableColumn, DataTable } from "@/components/shared/admin/data-table";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SelectField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { Button } from "@/components/shared/ui/button";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/shared/ui/sheet";
import {
  AUDIT_PAGE_SIZE,
  type AuditRow,
  exportAudit,
  listAuditEvents,
} from "@/lib/shared/audit/audit.functions";
import type { AuditActionKey } from "@/lib/shared/audit/actions";
import { auditActionLabels, auditDomains } from "@/lib/shared/audit/labels";
import { formatDateTime } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const route = getRouteApi("/admin/_app/(shared)/settings/audit");
const ALL_DOMAINS = "all";

const labelOf = (action: string): string => auditActionLabels[action as AuditActionKey] ?? action;

const dayStart = (value: string | undefined): string | undefined =>
  value ? new Date(`${value}T00:00:00`).toISOString() : undefined;

const dayAfter = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const end = new Date(`${value}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return end.toISOString();
};

export function AuditPage() {
  const search = route.useSearch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const page = search.page ?? 1;
  const filters = {
    ...(search.domain ? { domain: search.domain } : {}),
    ...(dayStart(search.from) ? { from: dayStart(search.from) } : {}),
    ...(dayAfter(search.to) ? { to: dayAfter(search.to) } : {}),
  };

  const query = useQuery({
    queryKey: QueryKey.Audit.list({ ...filters, page }),
    queryFn: async () => unwrapResult(await listAuditEvents({ data: { filters, page } })),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Record<string, string | number | undefined>) =>
    navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        page: undefined,
        ...patch,
      })) as never,
      replace: true,
    });

  const columns: DataTableColumn<AuditRow>[] = [
    { id: "when", label: "Quando", cell: (row) => formatDateTime(row.occurredAt) },
    {
      id: "actor",
      label: "Quem",
      cell: (row) => row.actorName ?? (row.actorKind === "system" ? "Sistema" : "Usuário removido"),
    },
    {
      id: "action",
      label: "O quê",
      cell: (row) => (
        <button
          type="button"
          className="text-left text-primary underline-offset-4 hover:underline"
          onClick={() => setSelected(row)}
        >
          {labelOf(row.action)}
        </button>
      ),
    },
    { id: "brand", label: "Marca", cell: (row) => row.brandName ?? "—" },
  ];

  async function exportCsv() {
    setExporting(true);
    try {
      const result = await exportAudit({ data: filters });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "auditoria.csv";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        description="O histórico de tudo que mudou na Aura Creative. Os registros não podem ser alterados."
        breadcrumbs={[{ label: "Configurações" }, { label: "Auditoria" }]}
        actions={
          <Button variant="outline" onClick={() => void exportCsv()} loading={exporting}>
            <Download aria-hidden="true" />
            Exportar CSV
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          id="audit-domain"
          label="Assunto"
          value={search.domain ?? ALL_DOMAINS}
          onValueChange={(value) =>
            void update({ domain: value === ALL_DOMAINS ? undefined : value })
          }
          options={[{ value: ALL_DOMAINS, label: "Todos" }, ...auditDomains]}
        />
        <DatePickerField
          id="audit-from"
          label="De"
          value={search.from ?? ""}
          onChange={(value) => void update({ from: value || undefined })}
          clearable
        />
        <DatePickerField
          id="audit-to"
          label="Até"
          value={search.to ?? ""}
          onChange={(value) => void update({ to: value || undefined })}
          clearable
        />
      </div>
      <DataTable
        caption="Eventos de auditoria"
        rows={query.data?.rows ?? []}
        columns={columns}
        rowKey={(row) => String(row.id)}
        rowLabel={(row) => labelOf(row.action)}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error?.message ?? null}
        onRetry={() => void query.refetch()}
        empty={
          <EmptyState
            icon={ScrollText}
            title="Nenhum evento neste período"
            description="Ajuste os filtros para ver outros registros."
          />
        }
        pagination={{
          page,
          pageSize: AUDIT_PAGE_SIZE,
          total: query.data?.total ?? 0,
          onPageChange: (next) => void update({ page: next === 1 ? undefined : next }),
        }}
      />
      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected ? labelOf(selected.action) : ""}</SheetTitle>
            <SheetDescription>
              {selected ? `${formatDateTime(selected.occurredAt)} · ${selected.entityType}` : ""}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Registro</dt>
                <dd className="break-all">{selected.entityId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Requisição</dt>
                <dd className="break-all">{selected.requestId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dados guardados</dt>
                <dd>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                    {selected.metadataText}
                  </pre>
                </dd>
              </div>
            </dl>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
