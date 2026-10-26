import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Printer } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { ReportView } from "@/components/shared/metrics/report-view";
import { Button } from "@/components/shared/ui/button";
import { portalGetMetricReport } from "@/lib/portal/metrics/portal-metrics.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function PortalReportPage({ brandId, reportId }: { brandId: string; reportId: string }) {
  const query = useQuery({
    queryKey: QueryKey.Portal.metricsReport(reportId),
    queryFn: async () => unwrapResult(await portalGetMetricReport({ data: { reportId } })).report,
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Relatório indisponível"
        description="Ele não existe mais ou você não tem acesso."
      />
    );
  }

  const report = query.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2" data-print="hide">
        <Button asChild variant="ghost" size="sm">
          <Link to="/portal/brands/$brandId/metrics" params={{ brandId }}>
            <ArrowLeft aria-hidden="true" />
            Todos os relatórios
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Salvar em PDF
        </Button>
      </div>
      <ReportView
        title={report.title}
        message={report.message}
        nextSteps={report.nextSteps}
        blocks={report.blocks}
        snapshot={report.snapshot}
        linkContent={false}
      />
    </div>
  );
}
