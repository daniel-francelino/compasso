import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BarChart3, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { portalListMetricReports } from "@/lib/portal/metrics/portal-metrics.functions";
import { formatDateOnly } from "@/lib/shared/format";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function PortalMetricsPage({ brandId }: { brandId: string }) {
  const query = useQuery({
    queryKey: QueryKey.Portal.metricsReports(brandId),
    queryFn: async () => unwrapResult(await portalListMetricReports({ data: { brandId } })).reports,
  });

  if (query.isPending) return <ListSkeleton />;
  if (query.isError) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Não foi possível carregar os resultados"
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
        icon={BarChart3}
        title="Ainda não há relatórios"
        description="Quando a equipe publicar um relatório de resultados, ele aparece aqui."
      />
    );
  }

  const [latest, ...older] = query.data;
  return (
    <div className="space-y-4">
      {latest ? (
        <SectionCard title="Relatório mais recente" icon={BarChart3}>
          <p className="font-medium text-foreground">{latest.title}</p>
          <p className="text-sm text-muted-foreground">
            {formatDateOnly(latest.periodStart)} a {formatDateOnly(latest.periodEnd)}
          </p>
          <Button asChild className="mt-2">
            <Link
              to="/portal/brands/$brandId/metrics/$reportId"
              params={{ brandId, reportId: latest.id }}
            >
              Abrir relatório
            </Link>
          </Button>
        </SectionCard>
      ) : null}
      {older.length > 0 ? (
        <SectionCard title="Relatórios anteriores">
          <ul className="divide-y divide-border">
            {older.map((report) => (
              <li key={report.id}>
                <Link
                  to="/portal/brands/$brandId/metrics/$reportId"
                  params={{ brandId, reportId: report.id }}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {report.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateOnly(report.periodStart)} a {formatDateOnly(report.periodEnd)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
