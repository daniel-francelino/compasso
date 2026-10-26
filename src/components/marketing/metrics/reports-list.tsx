import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, FileText, Pencil, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  type MetricReport,
  deleteMetricReport,
  listMetricReports,
  newMetricReportVersion,
  withdrawMetricReport,
} from "@/lib/marketing/metrics/metrics.functions";
import { MetricReportStatus } from "@/lib/shared/enums";
import { formatDateOnly, formatDateTime } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const statusBadges = {
  [MetricReportStatus.Draft]: { tone: "draft", icon: Pencil, label: "Rascunho" },
  [MetricReportStatus.Published]: { tone: "success", icon: CheckCircle2, label: "Publicado" },
  [MetricReportStatus.Withdrawn]: { tone: "neutral", icon: Undo2, label: "Retirado" },
} as const;

export function ReportsList({ brandId, canReport }: { brandId: string; canReport: boolean }) {
  const navigate = useNavigate();
  const { run, busy } = useServerAction();
  const [withdrawing, setWithdrawing] = useState<MetricReport | null>(null);
  const [deleting, setDeleting] = useState<MetricReport | null>(null);
  const invalidate = [QueryKey.Metrics.reports(brandId)];
  const query = useQuery({
    queryKey: QueryKey.Metrics.reports(brandId),
    queryFn: async () => unwrapResult(await listMetricReports({ data: { brandId } })).reports,
  });

  const open = (report: MetricReport) =>
    navigate({
      to: "/admin/marketing/brands/$brandId/metrics-report/$reportId",
      params: { brandId, reportId: report.id },
    });

  if (query.isPending) return <ListSkeleton />;
  if (query.isError) {
    return (
      <EmptyState
        icon={FileText}
        title="Não foi possível carregar os relatórios"
        description={query.error.message}
        action={
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }
  if (query.data.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nenhum relatório ainda"
        description="Em Análise, escolha o período e use Criar relatório para montar o que o cliente vai ver."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {query.data.map((report) => {
        const badge = statusBadges[report.status];
        return (
          <li key={report.id}>
            <SectionCard padding="sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium text-foreground">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateOnly(report.periodStart)} a {formatDateOnly(report.periodEnd)}
                    {report.publishedAt
                      ? ` · publicado em ${formatDateTime(report.publishedAt)}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={badge.tone} icon={badge.icon}>
                    {badge.label}
                  </StatusBadge>
                  <Button variant="outline" size="sm" onClick={() => void open(report)}>
                    {report.status === MetricReportStatus.Draft && canReport ? "Editar" : "Abrir"}
                  </Button>
                  {canReport && report.status === MetricReportStatus.Published ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => newMetricReportVersion({ data: { reportId: report.id } }),
                            { invalidate, success: "Nova versão criada como rascunho." },
                          )
                        }
                      >
                        Corrigir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setWithdrawing(report)}
                      >
                        Retirar
                      </Button>
                    </>
                  ) : null}
                  {canReport && report.status === MetricReportStatus.Draft ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setDeleting(report)}
                    >
                      <Trash2 aria-hidden="true" />
                      Excluir
                    </Button>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          </li>
        );
      })}
      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(next) => !next && setWithdrawing(null)}
        title="Retirar relatório"
        description={`«${withdrawing?.title ?? ""}» deixa de aparecer para o cliente. O registro continua guardado.`}
        confirmLabel="Retirar"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (withdrawing === null) return false;
          const result = await run(
            () => withdrawMetricReport({ data: { reportId: withdrawing.id } }),
            { invalidate, success: "Relatório retirado." },
          );
          return result.ok;
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title="Excluir rascunho"
        description={`O rascunho «${deleting?.title ?? ""}» será excluído.`}
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (deleting === null) return false;
          const result = await run(() => deleteMetricReport({ data: { reportId: deleting.id } }), {
            invalidate,
            success: "Rascunho excluído.",
          });
          return result.ok;
        }}
      />
    </ul>
  );
}
