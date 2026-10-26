import { MetricKey } from "@/lib/shared/enums";
import { formatNumber } from "@/lib/shared/format";
import { type Overview, deltaOf, followerGain, Trend } from "@/lib/shared/metrics/compute";

export type HighlightPost = {
  externalMediaId: string;
  postedLabel: string;
  value: number;
};

export type HighlightInput = {
  overview: Overview;
  periodLabel: string;
  bestPost: HighlightPost | null;
  bestFormat: { label: string; average: number; others: number; posts: number } | null;
  bestSlot: { label: string; posts: number } | null;
};

export const Importance = { High: 1, Medium: 2, Low: 3 } as const;

export const HighlightTone = { Good: "good", Bad: "bad", Neutral: "neutral" } as const;
export type HighlightTone = (typeof HighlightTone)[keyof typeof HighlightTone];

export type Highlight = {
  id: string;
  text: string;
  tone: HighlightTone;
  importance: number;
};

export const MIN_DAYS = 3;
export const MIN_POSTS_TO_COMPARE = 3;
export const RELEVANT_CHANGE = 0.1;
export const DROP_ALERT = 0.2;

const percentText = (value: number): string =>
  `${formatNumber(Math.round(Math.abs(value) * 100))}%`;

const growthHighlight = (
  id: string,
  subject: string,
  current: number | undefined,
  previous: number | undefined,
): Highlight | null => {
  const delta = deltaOf(current, previous);
  if (delta.percent === null || Math.abs(delta.percent) < RELEVANT_CHANGE) return null;
  const up = delta.trend === Trend.Up;
  return {
    id,
    text: `${subject} ${up ? "cresceu" : "caiu"} ${percentText(delta.percent)} em relação ao período anterior.`,
    tone: up ? HighlightTone.Good : HighlightTone.Bad,
    importance: Math.abs(delta.percent) >= DROP_ALERT && !up ? Importance.High : Importance.Medium,
  };
};

const BEST_FORMAT_RATIO = 1.3;

const formatHighlight = (format: HighlightInput["bestFormat"]): Highlight | null => {
  if (!format || format.posts < MIN_POSTS_TO_COMPARE || format.others <= 0) return null;
  const ratio = format.average / format.others;
  if (ratio < BEST_FORMAT_RATIO) return null;
  return {
    id: "best-format",
    text: `${format.label} tiveram, em média, ${formatNumber(ratio, 1)} vezes o resultado dos outros formatos.`,
    tone: HighlightTone.Good,
    importance: Importance.Medium,
  };
};

export const buildHighlights = (input: HighlightInput): Highlight[] => {
  const { overview } = input;
  const totals = overview.totals;
  const previous = overview.previous_totals;
  const found: (Highlight | null)[] = [];
  const reach = totals[MetricKey.Reach];

  if ((reach?.days ?? 0) < MIN_DAYS && (totals[MetricKey.FollowersTotal]?.days ?? 0) < MIN_DAYS) {
    return [
      {
        id: "little-data",
        text: "Ainda há poucos dias de dados. Os destaques aparecem conforme o histórico cresce.",
        tone: HighlightTone.Neutral,
        importance: Importance.Low,
      },
    ];
  }

  const gain = followerGain(totals[MetricKey.FollowersTotal]);
  const previousGain = previous ? followerGain(previous[MetricKey.FollowersTotal]) : undefined;
  if (gain !== undefined && gain !== 0) {
    const compare =
      previousGain !== undefined && previousGain > 0
        ? ` (${gain > previousGain ? "mais" : "menos"} que no período anterior, que teve ${formatNumber(previousGain)})`
        : "";
    found.push({
      id: "followers",
      text: `O perfil ${gain > 0 ? "ganhou" : "perdeu"} ${formatNumber(Math.abs(gain))} seguidores${compare}.`,
      tone: gain > 0 ? HighlightTone.Good : HighlightTone.Bad,
      importance: Importance.High,
    });
  }

  found.push(
    growthHighlight(
      "reach",
      "O alcance diário médio",
      reach?.avg,
      previous?.[MetricKey.Reach]?.avg,
    ),
    growthHighlight(
      "interactions",
      "As interações",
      totals[MetricKey.Interactions]?.sum,
      previous?.[MetricKey.Interactions]?.sum,
    ),
  );

  if (input.bestPost) {
    found.push({
      id: "best-post",
      text: `O post de ${input.bestPost.postedLabel} foi o de maior resultado: ${formatNumber(input.bestPost.value)}.`,
      tone: HighlightTone.Good,
      importance: Importance.Medium,
    });
  }

  found.push(formatHighlight(input.bestFormat));

  if (input.bestSlot && input.bestSlot.posts >= MIN_POSTS_TO_COMPARE) {
    found.push({
      id: "best-slot",
      text: `${input.bestSlot.label} concentra os melhores resultados.`,
      tone: HighlightTone.Good,
      importance: Importance.Low,
    });
  }

  const posts = overview.posts_published;
  const previousPosts = overview.previous_posts_published;
  if (previousPosts !== null && previousPosts > 0 && posts !== previousPosts) {
    found.push({
      id: "rhythm",
      text: `Foram ${formatNumber(posts)} posts, contra ${formatNumber(previousPosts)} no período anterior.`,
      tone: HighlightTone.Neutral,
      importance: Importance.Low,
    });
  }

  return found
    .filter((item): item is Highlight => item !== null)
    .sort((left, right) => left.importance - right.importance)
    .slice(0, 5);
};

export const summarySentence = (overview: Overview, periodLabel: string): string | null => {
  const gain = followerGain(overview.totals[MetricKey.FollowersTotal]);
  const reach = deltaOf(
    overview.totals[MetricKey.Reach]?.avg,
    overview.previous_totals?.[MetricKey.Reach]?.avg,
  );
  const parts: string[] = [];
  if (gain !== undefined && gain !== 0) {
    parts.push(`${gain > 0 ? "ganhou" : "perdeu"} ${formatNumber(Math.abs(gain))} seguidores`);
  }
  if (reach.percent !== null && reach.trend !== Trend.Flat) {
    parts.push(
      `${reach.trend === Trend.Up ? "o alcance cresceu" : "o alcance caiu"} ${percentText(reach.percent)}`,
    );
  }
  if (parts.length === 0) return null;
  return `${periodLabel}, o perfil ${parts.join(" e ")}.`;
};
