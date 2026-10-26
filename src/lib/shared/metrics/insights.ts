import { formatDate } from "@/lib/shared/format";
import type { BreakdownRow, TopPost } from "@/lib/shared/metrics/dto";
import { MIN_POSTS_TO_COMPARE, type HighlightInput } from "@/lib/shared/metrics/highlights";

export const postFormatLabels: Record<string, string> = {
  FEED: "Posts de feed",
  REELS: "Reels",
  STORY: "Stories",
  IMAGE: "Posts de imagem",
  VIDEO: "Vídeos",
  CAROUSEL_ALBUM: "Carrosséis",
};

export const singularFormatLabels: Record<string, string> = {
  FEED: "Feed",
  REELS: "Reels",
  STORY: "Story",
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  CAROUSEL_ALBUM: "Carrossel",
};

export const weekdayPlural = [
  "",
  "Segundas",
  "Terças",
  "Quartas",
  "Quintas",
  "Sextas",
  "Sábados",
  "Domingos",
];

export const formatKeyLabel = (key: string): string => postFormatLabels[key] ?? key;

const bestOf = (rows: BreakdownRow[]): BreakdownRow | null => {
  const eligible = rows.filter((row) => row.posts >= MIN_POSTS_TO_COMPARE);
  return eligible.reduce<BreakdownRow | null>(
    (best, row) => (best === null || row.average > best.average ? row : best),
    null,
  );
};

export const bestFormatOf = (rows: BreakdownRow[]): HighlightInput["bestFormat"] => {
  const best = bestOf(rows);
  if (best === null) return null;
  const otherPosts = rows.reduce((sum, row) => sum + row.posts, 0) - best.posts;
  const otherTotal = rows.reduce((sum, row) => sum + row.total, 0) - best.total;
  return {
    label: formatKeyLabel(best.key),
    average: best.average,
    others: otherPosts > 0 ? otherTotal / otherPosts : 0,
    posts: best.posts,
  };
};

export const bestSlotOf = (
  weekdays: BreakdownRow[],
  hours: BreakdownRow[],
): HighlightInput["bestSlot"] => {
  const day = bestOf(weekdays);
  const hour = bestOf(hours);
  const dayName = day ? weekdayPlural[Number(day.key)] : undefined;
  const hourName = hour ? `${hour.key}h` : undefined;
  const posts = Math.min(
    day?.posts ?? Number.MAX_SAFE_INTEGER,
    hour?.posts ?? Number.MAX_SAFE_INTEGER,
  );
  if (dayName && hourName) return { label: `${dayName} às ${hourName}`, posts };
  if (dayName) return { label: dayName, posts: day?.posts ?? 0 };
  if (hourName) return { label: `Posts às ${hourName}`, posts: hour?.posts ?? 0 };
  return null;
};

export const bestPostOf = (
  posts: TopPost[],
  by: string,
  timeZone: string,
): HighlightInput["bestPost"] => {
  const best = posts[0];
  const value = best?.metrics[by];
  if (best === undefined || value === undefined || value <= 0) return null;
  return {
    externalMediaId: best.external_media_id,
    postedLabel: formatDate(best.posted_at, timeZone).slice(0, 5),
    value,
  };
};
