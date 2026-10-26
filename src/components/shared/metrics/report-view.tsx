import { HighlightList } from "@/components/shared/metrics/highlight-list";
import { MetricsBlocks } from "@/components/shared/metrics/metrics-blocks";
import { SectionCard } from "@/components/shared/admin/section-card";
import type { ReportBlock, ReportSnapshot } from "@/lib/shared/metrics/report";

export function ReportView({
  title,
  message,
  nextSteps,
  blocks,
  snapshot,
  linkContent,
}: {
  title: string;
  message: string | null;
  nextSteps: string[];
  blocks: ReportBlock[];
  snapshot: ReportSnapshot;
  linkContent: boolean;
}) {
  return (
    <article className="space-y-4">
      <SectionCard>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {snapshot.periodLabel}
          {snapshot.account.username ? ` · @${snapshot.account.username}` : ""}
        </p>
        {message ? (
          <p className="mt-3 whitespace-pre-line text-sm text-foreground">{message}</p>
        ) : null}
        {snapshot.summary ? (
          <p className="mt-3 text-base font-medium text-foreground">{snapshot.summary}</p>
        ) : null}
        <div className="mt-3">
          <HighlightList items={snapshot.highlights} />
        </div>
      </SectionCard>
      <MetricsBlocks analysis={snapshot.analysis} blocks={blocks} linkContent={linkContent} />
      {nextSteps.length > 0 ? (
        <SectionCard title="Próximos passos">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </SectionCard>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Os números vêm do Instagram e podem diferir de outros relatórios por data de corte e fuso
        horário. Fuso usado: {snapshot.analysis.overview.timezone}.
      </p>
    </article>
  );
}
