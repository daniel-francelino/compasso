import { z } from "zod";
import { MetricKey } from "@/lib/shared/enums";
import { GRAPH_BASE, type MetaResult, graphGet } from "@/lib/shared/social/graph.server";
import { utcDayStartSeconds } from "@/lib/shared/dates";

const SECONDS_PER_DAY = 86400;
const CAPTION_EXCERPT_LENGTH = 200;
const MEDIA_PAGE_SIZE = 50;

export const ACCOUNT_METRICS: Record<string, MetricKey> = {
  reach: MetricKey.Reach,
  views: MetricKey.Views,
  profile_views: MetricKey.ProfileViews,
  accounts_engaged: MetricKey.AccountsEngaged,
  total_interactions: MetricKey.Interactions,
  likes: MetricKey.Likes,
  comments: MetricKey.Comments,
  saves: MetricKey.Saves,
  shares: MetricKey.Shares,
  profile_links_taps: MetricKey.ProfileLinkTaps,
};

export const POST_METRICS: Record<string, string> = {
  reach: "reach",
  views: "views",
  likes: "likes",
  comments: "comments",
  saves: "saves",
  shares: "shares",
  total_interactions: "interactions",
};

const FALLBACK_POST_METRICS = ["reach", "likes", "comments", "saves", "shares"];

const insightsSchema = z.object({
  data: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.object({ value: z.unknown() })).optional(),
      total_value: z
        .object({
          value: z.number().optional(),
          breakdowns: z
            .array(
              z.object({
                results: z
                  .array(
                    z.object({
                      dimension_values: z.array(z.string()),
                      value: z.number(),
                    }),
                  )
                  .optional(),
              }),
            )
            .optional(),
        })
        .optional(),
    }),
  ),
});

const mediaListSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      caption: z.string().optional(),
      media_type: z.string().optional(),
      media_product_type: z.string().optional(),
      permalink: z.string().optional(),
      timestamp: z.string().min(1),
    }),
  ),
});

export type DailyRow = { day: string; metric: MetricKey; value: number };

export type IndexedMedia = {
  externalMediaId: string;
  permalink: string | null;
  mediaType: string;
  productType: string | null;
  postedAt: string;
  captionExcerpt: string | null;
};

export type AudienceRow = {
  dimension: string;
  breakdown: Record<string, number | Record<string, number>>;
};

export const fetchAccountDay = async (
  token: string,
  accountId: string,
  day: string,
): Promise<MetaResult<DailyRow[]>> => {
  const since = utcDayStartSeconds(day);
  const result = await graphGet(
    `${GRAPH_BASE}/${accountId}/insights`,
    token,
    {
      metric: Object.keys(ACCOUNT_METRICS).join(","),
      period: "day",
      metric_type: "total_value",
      since: String(since),
      until: String(since + SECONDS_PER_DAY),
    },
    insightsSchema,
  );
  if (!result.ok) return result;
  const rows: DailyRow[] = [];
  for (const item of result.data.data) {
    const metric = ACCOUNT_METRICS[item.name];
    const value = item.total_value?.value;
    if (metric !== undefined && value !== undefined) rows.push({ day, metric, value });
  }
  return { ok: true, data: rows };
};

export const fetchMediaList = async (
  token: string,
  accountId: string,
): Promise<MetaResult<IndexedMedia[]>> => {
  const result = await graphGet(
    `${GRAPH_BASE}/${accountId}/media`,
    token,
    {
      fields: "id,caption,media_type,media_product_type,permalink,timestamp",
      limit: String(MEDIA_PAGE_SIZE),
    },
    mediaListSchema,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: result.data.data.map((item) => ({
      externalMediaId: item.id,
      permalink: item.permalink ?? null,
      mediaType: item.media_type ?? "UNKNOWN",
      productType: item.media_product_type ?? null,
      postedAt: item.timestamp,
      captionExcerpt: item.caption?.slice(0, CAPTION_EXCERPT_LENGTH) ?? null,
    })),
  };
};

const postMetricsOf = (data: z.infer<typeof insightsSchema>["data"]): Record<string, number> => {
  const metrics: Record<string, number> = {};
  for (const item of data) {
    const key = POST_METRICS[item.name];
    const value = item.values?.[0]?.value;
    if (key !== undefined && typeof value === "number") metrics[key] = value;
  }
  return metrics;
};

export const fetchPostMetrics = async (
  token: string,
  mediaId: string,
): Promise<MetaResult<Record<string, number>>> => {
  const full = await graphGet(
    `${GRAPH_BASE}/${mediaId}/insights`,
    token,
    { metric: Object.keys(POST_METRICS).join(",") },
    insightsSchema,
  );
  if (full.ok) return { ok: true, data: postMetricsOf(full.data.data) };
  const reduced = await graphGet(
    `${GRAPH_BASE}/${mediaId}/insights`,
    token,
    { metric: FALLBACK_POST_METRICS.join(",") },
    insightsSchema,
  );
  return reduced.ok ? { ok: true, data: postMetricsOf(reduced.data.data) } : reduced;
};

const audienceBreakdown = async (
  token: string,
  accountId: string,
  breakdown: string,
): Promise<MetaResult<Record<string, number>>> => {
  const result = await graphGet(
    `${GRAPH_BASE}/${accountId}/insights`,
    token,
    {
      metric: "follower_demographics",
      period: "lifetime",
      metric_type: "total_value",
      breakdown,
    },
    insightsSchema,
  );
  if (!result.ok) return result;
  const found: Record<string, number> = {};
  const results = result.data.data[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  for (const entry of results) found[entry.dimension_values.join("|")] = entry.value;
  return { ok: true, data: found };
};

export const fetchAudience = async (
  token: string,
  accountId: string,
): Promise<MetaResult<AudienceRow[]>> => {
  const country = await audienceBreakdown(token, accountId, "country");
  if (!country.ok) return country;
  const city = await audienceBreakdown(token, accountId, "city");
  const age = await audienceBreakdown(token, accountId, "age");
  const gender = await audienceBreakdown(token, accountId, "gender");
  const rows: AudienceRow[] = [{ dimension: "country", breakdown: country.data }];
  if (city.ok) rows.push({ dimension: "city", breakdown: city.data });
  if (age.ok && gender.ok) {
    rows.push({ dimension: "age_gender", breakdown: { age: age.data, gender: gender.data } });
  }
  return { ok: true, data: rows };
};
