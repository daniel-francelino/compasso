import { Link } from "@tanstack/react-router";
import { BarChart3, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SectionCard } from "@/components/shared/admin/section-card";
import { seriesColors } from "@/components/shared/metrics/chart-colors";
import {
  type ChartMark,
  ColumnBars,
  GrowthChart,
  RankBars,
  StackedBars,
} from "@/components/shared/metrics/charts";
import { StatTile } from "@/components/shared/metrics/stat-tile";
import { MetricKey, MetricMarkKind } from "@/lib/shared/enums";
import { formatDateOnly, formatDate, formatNumber, formatPercent } from "@/lib/shared/format";
import { deltaOf, engagementRate, followerGain } from "@/lib/shared/metrics/compute";
import type { Mark } from "@/lib/shared/metrics/dto";
import { formatKeyLabel, weekdayPlural } from "@/lib/shared/metrics/insights";
import { MIN_POSTS_TO_COMPARE } from "@/lib/shared/metrics/highlights";
import { PostRanking, postRankingLabels } from "@/lib/shared/metrics/ranking";
import {
  type Analysis,
  MetricBlockKind,
  type ReportBlock,
  metricBlockLabels,
} from "@/lib/shared/metrics/report";

const markKindLabels: Record<MetricMarkKind, string> = {
  [MetricMarkKind.Campaign]: "Campanha",
  [MetricMarkKind.ViralPost]: "Post que viralizou",
  [MetricMarkKind.Partnership]: "Parceria",
  [MetricMarkKind.Event]: "Evento",
  [MetricMarkKind.Other]: "Marca",
};

const TOP_ENTRIES = 5;

type BlockContext = {
  analysis: Analysis;
  zone: string;
  rankBy: PostRanking;
  linkContent: boolean;
  comparing: boolean;
};

const NoData = () => <EmptyState compact icon={BarChart3} title="Sem dados neste período" />;

const seriesOf = (analysis: Analysis, key: MetricKey) => analysis.overview.series[key] ?? [];

const previousOf = (analysis: Analysis, key: MetricKey) =>
  analysis.overview.previous_series?.[key] ?? null;

const chartMarks = (analysis: Analysis): ChartMark[] => {
  const starts = seriesOf(analysis, MetricKey.Reach)
    .concat(seriesOf(analysis, MetricKey.FollowersTotal))
    .map((point) => point.start)
    .sort();
  const first = starts[0];
  if (first === undefined) return [];
  return analysis.marks.flatMap((mark) => {
    const bucket = [...starts].reverse().find((start) => start <= mark.starts_on) ?? first;
    return [{ start: bucket, label: mark.label }];
  });
};

function SummaryBlock({ analysis, comparing }: BlockContext) {
  const { totals, previous_totals: previous } = analysis.overview;
  const compare = (key: MetricKey, field: "sum" | "avg") =>
    comparing
      ? deltaOf(totals[key]?.[field], previous?.[key]?.[field])
      : deltaOf(undefined, undefined);
  const gain = followerGain(totals[MetricKey.FollowersTotal]);
  const previousGain = followerGain(previous?.[MetricKey.FollowersTotal]);
  const followers = totals[MetricKey.FollowersTotal];
  const reach = totals[MetricKey.Reach];
  const sumOf = (key: MetricKey) => (totals[key] ? formatNumber(totals[key].sum) : null);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatTile
        label="Seguidores"
        value={followers ? formatNumber(followers.last) : null}
        caption={
          gain === undefined
            ? undefined
            : `${gain >= 0 ? "+" : "−"}${formatNumber(Math.abs(gain))} no período`
        }
        delta={comparing ? deltaOf(gain, previousGain) : deltaOf(undefined, undefined)}
      />
      <StatTile
        label="Alcance médio por dia"
        value={reach ? formatNumber(reach.avg) : null}
        caption="Pessoas diferentes que viram o conteúdo"
        delta={compare(MetricKey.Reach, "avg")}
      />
      <StatTile
        label="Visualizações"
        value={sumOf(MetricKey.Views)}
        delta={compare(MetricKey.Views, "sum")}
      />
      <StatTile
        label="Interações"
        value={sumOf(MetricKey.Interactions)}
        caption="Curtidas, comentários, salvamentos e compartilhamentos"
        delta={compare(MetricKey.Interactions, "sum")}
      />
      <StatTile
        label="Visitas ao perfil"
        value={sumOf(MetricKey.ProfileViews)}
        delta={compare(MetricKey.ProfileViews, "sum")}
      />
      <StatTile
        label="Posts publicados"
        value={formatNumber(analysis.overview.posts_published)}
        delta={
          comparing
            ? deltaOf(
                analysis.overview.posts_published,
                analysis.overview.previous_posts_published ?? undefined,
              )
            : deltaOf(undefined, undefined)
        }
      />
    </div>
  );
}

function FollowersBlock({ analysis }: BlockContext) {
  const points = seriesOf(analysis, MetricKey.FollowersTotal);
  const gain = followerGain(analysis.overview.totals[MetricKey.FollowersTotal]);
  if (points.length === 0) return <NoData />;
  const first = points[0]?.value ?? 0;
  const last = points.at(-1)?.value ?? 0;
  return (
    <GrowthChart
      current={points}
      previous={previousOf(analysis, MetricKey.FollowersTotal)}
      marks={chartMarks(analysis)}
      label="Seguidores"
      description={`Seguidores foram de ${formatNumber(first)} para ${formatNumber(last)} no período${
        gain === undefined ? "" : ` (${gain >= 0 ? "+" : "−"}${formatNumber(Math.abs(gain))})`
      }.`}
    />
  );
}

function ReachBlock({ analysis }: BlockContext) {
  const reach = seriesOf(analysis, MetricKey.Reach);
  const views = seriesOf(analysis, MetricKey.Views);
  if (reach.length === 0 && views.length === 0) return <NoData />;
  const total = analysis.overview.totals[MetricKey.Reach];
  return (
    <div className="space-y-4">
      {reach.length > 0 ? (
        <GrowthChart
          current={reach}
          previous={previousOf(analysis, MetricKey.Reach)}
          marks={chartMarks(analysis)}
          label="Alcance"
          color={seriesColors[0]}
          description={`Alcance somado por período, média de ${formatNumber(total?.avg ?? 0)} por dia.`}
        />
      ) : null}
      {views.length > 0 ? (
        <GrowthChart
          current={views}
          previous={previousOf(analysis, MetricKey.Views)}
          marks={[]}
          label="Visualizações"
          color={seriesColors[1]}
          description="Visualizações somadas por período."
        />
      ) : null}
    </div>
  );
}

const STACK = [
  { key: MetricKey.Likes, label: "Curtidas", color: seriesColors[0] },
  { key: MetricKey.Comments, label: "Comentários", color: seriesColors[1] },
  { key: MetricKey.Saves, label: "Salvamentos", color: seriesColors[2] },
  { key: MetricKey.Shares, label: "Compartilhamentos", color: seriesColors[3] },
];

function InteractionsBlock({ analysis }: BlockContext) {
  const starts = [
    ...new Set(STACK.flatMap((item) => seriesOf(analysis, item.key).map((point) => point.start))),
  ].sort();
  if (starts.length === 0) return <NoData />;
  const data = starts.map((start) => ({
    start,
    ...Object.fromEntries(
      STACK.map((item) => [
        item.key,
        seriesOf(analysis, item.key).find((point) => point.start === start)?.value ?? 0,
      ]),
    ),
  }));
  const rate = engagementRate(
    analysis.overview.totals[MetricKey.Interactions]?.sum,
    analysis.overview.totals[MetricKey.Reach]?.sum,
  );
  return (
    <div className="space-y-3">
      <StackedBars
        data={data}
        series={STACK}
        description="Curtidas, comentários, salvamentos e compartilhamentos por período."
      />
      {rate === null ? null : (
        <p className="text-sm text-muted-foreground">
          Taxa de engajamento: <strong className="text-foreground">{formatPercent(rate, 1)}</strong>{" "}
          (interações divididas pelo alcance).
        </p>
      )}
    </div>
  );
}

function TopPostsBlock({ analysis, zone, rankBy, linkContent }: BlockContext) {
  const posts = analysis.topPosts.filter((post) => (post.metrics[rankBy] ?? 0) > 0);
  if (posts.length === 0) return <NoData />;
  const top = Math.max(...posts.map((post) => post.metrics[rankBy] ?? 0));
  return (
    <ol className="space-y-3">
      {posts.map((post, index) => {
        const value = post.metrics[rankBy] ?? 0;
        return (
          <li
            key={post.external_media_id}
            className="space-y-1.5 rounded-xl border border-border p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 text-sm text-foreground">
                <span className="font-semibold">{index + 1}. </span>
                {post.caption_excerpt?.trim() || "Post sem legenda"}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {formatNumber(value)}{" "}
                <span className="font-normal text-muted-foreground">
                  {postRankingLabels[rankBy].toLowerCase()}
                </span>
              </p>
            </div>
            <div className="h-2 rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-2 rounded-full bg-chart-1"
                style={{ width: `${Math.max(4, Math.round((value / top) * 100))}%` }}
              />
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {formatDate(post.posted_at, zone)} ·{" "}
                {formatKeyLabel(post.product_type ?? post.media_type)}
              </span>
              {post.item_title ? (
                linkContent && post.item_id ? (
                  <Link
                    to="/admin/marketing/content/$itemId"
                    params={{ itemId: post.item_id }}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Conteúdo: {post.item_title}
                  </Link>
                ) : (
                  <span>Conteúdo: {post.item_title}</span>
                )
              ) : (
                <span>Publicado fora do Compasso</span>
              )}
              {post.permalink ? (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  Abrir no Instagram
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

const rankItems = (rows: Analysis["formats"], label: (key: string) => string) =>
  rows
    .filter((row) => row.posts >= MIN_POSTS_TO_COMPARE)
    .map((row) => ({
      key: row.key,
      label: `${label(row.key)} (${row.posts})`,
      value: row.average,
    }));

function FormatsBlock({ analysis, rankBy }: BlockContext) {
  const items = rankItems(analysis.formats, formatKeyLabel);
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        icon={BarChart3}
        title="Poucos posts para comparar"
        description={`São necessários ao menos ${MIN_POSTS_TO_COMPARE} posts por formato no período.`}
      />
    );
  }
  return (
    <RankBars
      items={items}
      valueLabel={`Média de ${postRankingLabels[rankBy].toLowerCase()} por post`}
      format={(value) => formatNumber(value)}
      description={`Média de ${postRankingLabels[rankBy].toLowerCase()} por post, por formato. O número entre parênteses é a quantidade de posts.`}
    />
  );
}

function ScheduleBlock({ analysis, rankBy }: BlockContext) {
  const days = rankItems(analysis.weekdays, (key) => weekdayPlural[Number(key)] ?? key);
  const hours = analysis.hours
    .filter((row) => row.posts >= MIN_POSTS_TO_COMPARE)
    .map((row) => ({ key: row.key, label: `${row.key}h`, value: row.average }))
    .sort((left, right) => Number(left.key) - Number(right.key));
  if (days.length === 0 && hours.length === 0) {
    return (
      <EmptyState
        compact
        icon={BarChart3}
        title="Poucos posts para comparar"
        description={`São necessários ao menos ${MIN_POSTS_TO_COMPARE} posts por dia ou horário no período.`}
      />
    );
  }
  const label = postRankingLabels[rankBy].toLowerCase();
  return (
    <div className="space-y-4">
      {days.length > 0 ? (
        <RankBars
          items={days}
          valueLabel={`Média de ${label}`}
          description={`Média de ${label} por post, por dia da semana.`}
        />
      ) : null}
      {hours.length > 0 ? (
        <ColumnBars
          items={hours}
          valueLabel={`Média de ${label}`}
          description={`Média de ${label} por post, por horário.`}
        />
      ) : null}
    </div>
  );
}

const topEntries = (breakdown: Analysis["audience"][number]["breakdown"], limit: number) =>
  Object.entries(breakdown)
    .flatMap(([key, value]) => (typeof value === "number" ? [{ key, label: key, value }] : []))
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);

function AudienceBlock({ analysis }: BlockContext) {
  const latest = new Map(analysis.audience.map((row) => [row.dimension, row.breakdown]));
  const country = latest.get("country");
  const city = latest.get("city");
  const ageGender = latest.get("age_gender");
  const age = ageGender?.["age"];
  const gender = ageGender?.["gender"];
  const asItems = (record: Record<string, number> | number | undefined) =>
    typeof record === "object" ? topEntries(record, TOP_ENTRIES) : [];
  const sections: [string, ReturnType<typeof topEntries>][] = [
    ["Países", country ? topEntries(country, TOP_ENTRIES) : []],
    ["Cidades", city ? topEntries(city, TOP_ENTRIES) : []],
    ["Idade", asItems(age)],
    ["Gênero", asItems(gender)],
  ];
  const filled = sections.filter(([, items]) => items.length > 0);
  if (filled.length === 0) {
    return (
      <EmptyState
        compact
        icon={BarChart3}
        title="Audiência indisponível"
        description="O Instagram só entrega esses dados para perfis com 100 seguidores ou mais."
      />
    );
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {filled.map(([title, items]) => (
        <div key={title} className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <RankBars
            items={items}
            valueLabel="Seguidores"
            description={`${title} com mais seguidores.`}
          />
        </div>
      ))}
    </div>
  );
}

function PlanBlock({ analysis }: BlockContext) {
  const plan = analysis.plan;
  const rows: [string, number][] = [
    ["Planejados no período", plan.planned],
    ["Publicados", plan.published],
    ["Com publicação automática", plan.automatic],
    ["Publicados automaticamente", plan.published_automatically],
    ["Que falharam", plan.failed],
  ];
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-semibold text-foreground">{formatNumber(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function MarksBlock({ analysis }: BlockContext) {
  if (analysis.marks.length === 0) {
    return <EmptyState compact title="Nenhuma marca neste período" />;
  }
  return (
    <ul className="space-y-2">
      {analysis.marks.map((mark: Mark) => (
        <li key={mark.id} className="rounded-lg border border-border p-3 text-sm">
          <p className="font-medium text-foreground">{mark.label}</p>
          <p className="text-xs text-muted-foreground">
            {markKindLabels[mark.kind]} · {formatDateOnly(mark.starts_on)}
            {mark.ends_on ? ` a ${formatDateOnly(mark.ends_on)}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

const renderers: Record<MetricBlockKind, (context: BlockContext) => ReactNode> = {
  [MetricBlockKind.Summary]: SummaryBlock,
  [MetricBlockKind.Followers]: FollowersBlock,
  [MetricBlockKind.Reach]: ReachBlock,
  [MetricBlockKind.Interactions]: InteractionsBlock,
  [MetricBlockKind.TopPosts]: TopPostsBlock,
  [MetricBlockKind.Formats]: FormatsBlock,
  [MetricBlockKind.Schedule]: ScheduleBlock,
  [MetricBlockKind.Audience]: AudienceBlock,
  [MetricBlockKind.Plan]: PlanBlock,
  [MetricBlockKind.Marks]: MarksBlock,
};

export function MetricsBlocks({
  analysis,
  blocks,
  rankBy = PostRanking.Reach,
  linkContent,
}: {
  analysis: Analysis;
  blocks: ReportBlock[];
  rankBy?: PostRanking;
  linkContent: boolean;
}) {
  const context: BlockContext = {
    analysis,
    zone: analysis.overview.timezone,
    rankBy,
    linkContent,
    comparing: analysis.overview.previous_totals !== null,
  };
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const Render = renderers[block.kind];
        return (
          <SectionCard
            key={`${block.kind}-${index}`}
            title={block.title || metricBlockLabels[block.kind]}
          >
            <Render {...context} />
            {block.comment ? (
              <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                {block.comment}
              </p>
            ) : null}
          </SectionCard>
        );
      })}
    </div>
  );
}
