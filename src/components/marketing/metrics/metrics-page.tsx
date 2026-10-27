import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BarChart3, FilePlus2, Printer, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { MarksPanel } from "@/components/marketing/metrics/marks-panel";
import { ReportsList } from "@/components/marketing/metrics/reports-list";
import { SelectField } from "@/components/shared/admin/form-fields";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { HighlightList } from "@/components/shared/metrics/highlight-list";
import { MetricsBlocks } from "@/components/shared/metrics/metrics-blocks";
import { Button } from "@/components/shared/ui/button";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { useBrand } from "@/hooks/marketing/use-brand";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { listChannels } from "@/lib/marketing/channels/channels.functions";
import { listChannelConnections } from "@/lib/marketing/channels/connection.functions";
import { ChannelStatusFilter } from "@/lib/marketing/channels/schemas";
import { getMetricsAnalysis, saveMetricReport } from "@/lib/marketing/metrics/metrics.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { MetricCompare, MetricGranularity } from "@/lib/shared/enums";
import { buildHighlights, summarySentence } from "@/lib/shared/metrics/highlights";
import { bestFormatOf, bestPostOf, bestSlotOf } from "@/lib/shared/metrics/insights";
import {
  PeriodPreset,
  periodLabel,
  periodPresetLabels,
  presetRange,
} from "@/lib/shared/metrics/period";
import { PostRanking, postRankingLabels } from "@/lib/shared/metrics/ranking";
import { MetricBlockKind, defaultReportBlocks } from "@/lib/shared/metrics/report";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { daysBetweenDates, todayInZone } from "@/lib/shared/dates";

const View = { Analysis: "analysis", Reports: "reports" } as const;

const LONG_PERIOD_DAYS = 62;
const VERY_LONG_PERIOD_DAYS = 200;

export type MetricsSearch = {
  channel?: string | undefined;
  preset?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  compare?: MetricCompare | undefined;
  rankBy?: PostRanking | undefined;
  view?: string | undefined;
};

const isPreset = (value: string | undefined): value is PeriodPreset =>
  Object.values(PeriodPreset).some((preset) => preset === value);

const granularityFor = (days: number): MetricGranularity => {
  if (days > VERY_LONG_PERIOD_DAYS) return MetricGranularity.Month;
  return days > LONG_PERIOD_DAYS ? MetricGranularity.Week : MetricGranularity.Day;
};

const allBlocks = Object.values(MetricBlockKind).map((kind) => ({ kind }));

const compareOptions = [
  { value: MetricCompare.Previous, label: "Período anterior" },
  { value: MetricCompare.Year, label: "Mesmo período do ano passado" },
  { value: MetricCompare.None, label: "Sem comparação" },
];

export function MetricsPage({
  brandId,
  search,
  onSearch,
}: {
  brandId: string;
  search: MetricsSearch;
  onSearch: (patch: MetricsSearch) => void;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { run, busy } = useServerAction();
  const brand = useBrand(brandId);
  const zone = brand.data?.timezone ?? "America/Sao_Paulo";
  const today = todayInZone(zone);

  const connections = useQuery({
    queryKey: QueryKey.Channels.connections(brandId),
    queryFn: async () =>
      unwrapResult(await listChannelConnections({ data: { brandId } })).connections,
  });
  const channels = useQuery({
    queryKey: QueryKey.Channels.list(brandId, { status: ChannelStatusFilter.Active }),
    queryFn: async () =>
      unwrapResult(await listChannels({ data: { brandId, status: ChannelStatusFilter.Active } }))
        .channels,
  });

  const options = useMemo(
    () =>
      (connections.data ?? [])
        .filter((connection) => connection.collectMetrics)
        .map((connection) => ({
          value: connection.channelId,
          label: `@${connection.username}`,
        })),
    [connections.data],
  );
  const channelId = search.channel ?? options[0]?.value;
  const preset = isPreset(search.preset) ? search.preset : PeriodPreset.Last30;
  const fallback = presetRange(PeriodPreset.Last30, today) ?? { from: today, to: today };
  const range =
    preset === PeriodPreset.Custom
      ? { from: search.from ?? fallback.from, to: search.to ?? fallback.to }
      : (presetRange(preset, today) ?? fallback);
  const compare = search.compare ?? MetricCompare.Previous;
  const rankBy = search.rankBy ?? PostRanking.Reach;
  const granularity = granularityFor(daysBetweenDates(range.from, range.to) + 1);
  const view = search.view === View.Reports ? View.Reports : View.Analysis;
  const canReport = can(auth, Action.Metrics.Report);

  const filters = { channelId, ...range, compare, rankBy, granularity };
  const analysis = useQuery({
    queryKey: QueryKey.Metrics.overview(brandId, filters),
    enabled: channelId !== undefined && view === View.Analysis,
    queryFn: async () =>
      unwrapResult(
        await getMetricsAnalysis({
          data: { brandId, channelId: channelId ?? "", ...range, compare, rankBy, granularity },
        }),
      ).analysis,
  });

  const label = periodLabel(range);
  const insight = useMemo(() => {
    if (!analysis.data) return null;
    const data = analysis.data;
    return {
      summary: summarySentence(data.overview, label),
      highlights: buildHighlights({
        overview: data.overview,
        periodLabel: label,
        bestPost: bestPostOf(data.topPosts, rankBy, data.overview.timezone),
        bestFormat: bestFormatOf(data.formats),
        bestSlot: bestSlotOf(data.weekdays, data.hours),
      }),
    };
  }, [analysis.data, label, rankBy]);

  const createReport = async () => {
    if (channelId === undefined) return;
    const result = await run(() =>
      saveMetricReport({
        data: {
          brandId,
          channelId,
          periodStart: range.from,
          periodEnd: range.to,
          compareMode: compare,
          title: `Resultados · ${label}`,
          nextSteps: [],
          blocks: defaultReportBlocks.map((kind) => ({ kind })),
        },
      }),
    );
    if (!result.ok) return;
    void navigate({
      to: "/admin/marketing/brands/$brandId/metrics-report/$reportId",
      params: { brandId, reportId: result.id },
    });
  };

  if (connections.isPending || channels.isPending) return <ListSkeleton />;
  if (options.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Conecte o Instagram para ver as métricas"
        description="As métricas vêm da conta conectada ao canal. Depois de conectar, o Compasso guarda o histórico a partir daquele dia."
        action={
          <Button
            variant="outline"
            onClick={() =>
              void navigate({
                to: "/admin/marketing/brands/$brandId/channels",
                params: { brandId },
              })
            }
          >
            Ir para os canais
          </Button>
        }
      />
    );
  }

  const channelName = channels.data?.find((channel) => channel.id === channelId)?.profileName;

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={(next) => onSearch({ view: next })} data-print="hide">
        <TabsList>
          <TabsTrigger value={View.Analysis}>Análise</TabsTrigger>
          <TabsTrigger value={View.Reports}>Relatórios</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === View.Reports ? (
        <ReportsList brandId={brandId} canReport={canReport} />
      ) : (
        <>
          <SectionCard data-print="hide" padding="sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {options.length > 1 ? (
                <SelectField
                  id="metrics-channel"
                  label="Canal"
                  value={channelId ?? ""}
                  onValueChange={(value) => onSearch({ channel: value })}
                  options={options}
                />
              ) : null}
              <SelectField
                id="metrics-period"
                label="Período"
                value={preset}
                onValueChange={(value) =>
                  onSearch({ preset: value, from: undefined, to: undefined })
                }
                options={Object.values(PeriodPreset).map((value) => ({
                  value,
                  label: periodPresetLabels[value],
                }))}
              />
              <SelectField
                id="metrics-compare"
                label="Comparar com"
                value={compare}
                onValueChange={(value) =>
                  onSearch({ compare: Object.values(MetricCompare).find((item) => item === value) })
                }
                options={compareOptions}
              />
              <SelectField
                id="metrics-rank"
                label="Melhores posts por"
                value={rankBy}
                onValueChange={(value) =>
                  onSearch({ rankBy: Object.values(PostRanking).find((item) => item === value) })
                }
                options={Object.values(PostRanking).map((value) => ({
                  value,
                  label: postRankingLabels[value],
                }))}
              />
            </div>
            {preset === PeriodPreset.Custom ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <DatePickerField
                  id="metrics-from"
                  label="De"
                  value={range.from}
                  onChange={(value) => onSearch({ preset, from: value, to: range.to })}
                />
                <DatePickerField
                  id="metrics-to"
                  label="Até"
                  value={range.to}
                  minDate={range.from}
                  onChange={(value) => onSearch({ preset, from: range.from, to: value })}
                />
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {canReport ? (
                <Button onClick={() => void createReport()} loading={busy}>
                  <FilePlus2 aria-hidden="true" />
                  Criar relatório
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => window.print()}>
                <Printer aria-hidden="true" />
                Exportar PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => void analysis.refetch()}
                disabled={analysis.isFetching}
              >
                <RefreshCw aria-hidden="true" />
                Atualizar
              </Button>
            </div>
          </SectionCard>

          {analysis.isPending ? <ListSkeleton /> : null}
          {analysis.isError ? (
            <EmptyState
              icon={BarChart3}
              title="Não foi possível carregar as métricas"
              description={analysis.error.message}
              action={
                <Button variant="outline" onClick={() => void analysis.refetch()}>
                  Tentar novamente
                </Button>
              }
            />
          ) : null}
          {analysis.data && insight ? (
            <>
              <SectionCard>
                <h2 className="text-lg font-semibold text-foreground">
                  {channelName ? `${channelName} · ` : ""}
                  {label}
                </h2>
                {analysis.data.overview.first_day ? (
                  <p className="text-xs text-muted-foreground">
                    Dados a partir de{" "}
                    {analysis.data.overview.first_day.split("-").reverse().join("/")}. Fuso:{" "}
                    {analysis.data.overview.timezone}. O dia de hoje pode estar incompleto.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Ainda não há dados. A coleta começa logo após a conexão e roda a cada hora.
                  </p>
                )}
                {insight.summary ? (
                  <p className="mt-2 text-base font-medium text-foreground">{insight.summary}</p>
                ) : null}
                <div className="mt-2">
                  <HighlightList items={insight.highlights} />
                </div>
              </SectionCard>
              <MetricsBlocks
                analysis={analysis.data}
                blocks={allBlocks}
                rankBy={rankBy}
                linkContent
              />
              {channelId ? (
                <div data-print="hide">
                  <MarksPanel
                    brandId={brandId}
                    channelId={channelId}
                    marks={analysis.data.marks}
                    today={today}
                    canEdit={canReport}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
