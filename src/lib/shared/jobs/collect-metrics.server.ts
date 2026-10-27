import { z } from "zod";
import { instagramConfig } from "@/lib/shared/env.server";
import {
  type AdminClient,
  type ConnectionSecret,
  markConnectionLost,
  readConnectionSecret,
} from "@/lib/shared/jobs/connection-token.server";
import { logError } from "@/lib/shared/logger";
import { MetricKey } from "@/lib/shared/enums";
import {
  fetchAccountDay,
  fetchAudience,
  fetchMediaList,
  fetchPostMetrics,
} from "@/lib/shared/social/instagram-insights.server";
import { getProfile } from "@/lib/shared/social/instagram.server";
import { PublishErrorCode } from "@/lib/shared/social/publish-codes";
import { adminClient } from "@/lib/shared/supabase/admin.server";
import {
  addDaysToDate,
  daysBetweenDates,
  isOlderThan,
  nowMs,
  todayInZone,
} from "@/lib/shared/dates";

const COLLECT_INTERVAL_MS = 60 * 60 * 1000;
const BACKFILL_DAYS = 30;
const DAYS_PER_RUN = 5;
const POSTS_PER_RUN = 10;
const AUDIENCE_EVERY_DAYS = 7;
const AUDIENCE_MIN_FOLLOWERS = 100;
const BUDGET_MS = 8000;

const targetsSchema = z.array(
  z.object({
    channel_id: z.string().uuid(),
    brand_id: z.string().uuid(),
    last_metrics_at: z.string().nullable(),
    timezone: z.string(),
  }),
);

const dueSchema = z.array(
  z.object({
    external_media_id: z.string(),
    bucket: z.string(),
  }),
);

type Target = z.infer<typeof targetsSchema>[number];

export type CollectResult = {
  ok: boolean;
  skipped: boolean;
  channel: string | null;
  days: number;
  posts: number;
};

const isDue = (target: Target): boolean =>
  target.last_metrics_at === null || isOlderThan(target.last_metrics_at, COLLECT_INTERVAL_MS);

const lastStoredDay = async (admin: AdminClient, channelId: string): Promise<string | null> => {
  const { data } = await admin
    .from("channel_metric_daily")
    .select("day")
    .eq("channel_id", channelId)
    .eq("metric", MetricKey.Reach)
    .order("day", { ascending: false })
    .limit(1);
  return data?.[0]?.day ?? null;
};

const lastAudienceDay = async (admin: AdminClient, channelId: string): Promise<string | null> => {
  const { data } = await admin
    .from("channel_audience_snapshot")
    .select("captured_on")
    .eq("channel_id", channelId)
    .order("captured_on", { ascending: false })
    .limit(1);
  return data?.[0]?.captured_on ?? null;
};

const collectDays = async (
  admin: AdminClient,
  secret: ConnectionSecret,
  today: string,
  startedAt: number,
): Promise<{ stored: number; complete: boolean; lost: boolean }> => {
  const last = await lastStoredDay(admin, secret.channelId);
  const first = last === null ? addDaysToDate(today, -BACKFILL_DAYS) : addDaysToDate(last, 1);
  const yesterday = addDaysToDate(today, -1);
  const pending = Math.max(daysBetweenDates(first, yesterday) + 1, 0);
  const days = Array.from({ length: Math.min(pending, DAYS_PER_RUN) }, (_, index) =>
    addDaysToDate(first, index),
  );
  let stored = 0;
  for (const day of days) {
    if (nowMs() - startedAt > BUDGET_MS) return { stored, complete: false, lost: false };
    const rows = await fetchAccountDay(secret.token, secret.accountId, day);
    if (!rows.ok) {
      return {
        stored,
        complete: false,
        lost: rows.code === PublishErrorCode.ConnectionExpired,
      };
    }
    if (rows.data.length > 0) {
      await admin.rpc("metrics_store_daily", { p_channel: secret.channelId, p_rows: rows.data });
      stored += 1;
    }
  }
  return { stored, complete: pending <= DAYS_PER_RUN, lost: false };
};

const collectPosts = async (admin: AdminClient, secret: ConnectionSecret): Promise<number> => {
  const list = await fetchMediaList(secret.token, secret.accountId);
  if (list.ok) {
    await admin.rpc("metrics_store_media", {
      p_channel: secret.channelId,
      p_rows: list.data.map((item) => ({
        external_media_id: item.externalMediaId,
        permalink: item.permalink ?? "",
        media_type: item.mediaType,
        product_type: item.productType ?? "",
        posted_at: item.postedAt,
        caption_excerpt: item.captionExcerpt ?? "",
      })),
    });
  }
  const { data } = await admin.rpc("metrics_media_due", {
    p_channel: secret.channelId,
    p_limit: POSTS_PER_RUN,
  });
  const due = dueSchema.safeParse(data);
  if (!due.success) return 0;
  let stored = 0;
  for (const entry of due.data) {
    const metrics = await fetchPostMetrics(secret.token, entry.external_media_id);
    if (!metrics.ok) continue;
    await admin.rpc("metrics_store_post", {
      p_channel: secret.channelId,
      p_external: entry.external_media_id,
      p_bucket: entry.bucket,
      p_metrics: metrics.data,
    });
    stored += 1;
  }
  return stored;
};

const collectAudience = async (
  admin: AdminClient,
  secret: ConnectionSecret,
  today: string,
  followers: number | null,
): Promise<void> => {
  if (followers === null || followers < AUDIENCE_MIN_FOLLOWERS) return;
  const last = await lastAudienceDay(admin, secret.channelId);
  if (last !== null && daysBetweenDates(last, today) < AUDIENCE_EVERY_DAYS) return;
  const audience = await fetchAudience(secret.token, secret.accountId);
  if (!audience.ok) return;
  await admin.rpc("metrics_store_audience", {
    p_channel: secret.channelId,
    p_on: today,
    p_rows: audience.data,
  });
};

const dropIfLost = async (
  admin: AdminClient,
  channelId: string,
  code: PublishErrorCode,
): Promise<void> => {
  if (code === PublishErrorCode.ConnectionExpired) await markConnectionLost(admin, channelId);
};

const collectChannel = async (admin: AdminClient, target: Target): Promise<CollectResult> => {
  const result: CollectResult = {
    ok: true,
    skipped: false,
    channel: target.channel_id,
    days: 0,
    posts: 0,
  };
  const config = instagramConfig();
  if (config === null) return { ...result, skipped: true };
  const secret = await readConnectionSecret(admin, config, target.channel_id);
  if (!secret.ok) {
    await markConnectionLost(admin, target.channel_id);
    return { ...result, ok: false };
  }

  const startedAt = nowMs();
  const today = todayInZone(target.timezone);
  const profile = await getProfile(secret.secret.token);
  if (!profile.ok) {
    await dropIfLost(admin, target.channel_id, profile.code);
    return { ...result, ok: false };
  }
  const followers = profile.data.followersCount;
  if (followers !== null) {
    await admin.rpc("metrics_store_daily", {
      p_channel: target.channel_id,
      p_rows: [{ day: today, metric: MetricKey.FollowersTotal, value: followers }],
    });
  }

  const days = await collectDays(admin, secret.secret, today, startedAt);
  if (days.lost) {
    await markConnectionLost(admin, target.channel_id);
    return { ...result, ok: false, days: days.stored };
  }
  const posts = await collectPosts(admin, secret.secret);
  await collectAudience(admin, secret.secret, today, followers);
  if (days.complete) {
    await admin.rpc("metrics_collection_done", {
      p_channel: target.channel_id,
      p_followers: followers,
    });
  }
  return { ...result, days: days.stored, posts };
};

export const runCollectMetrics = async (): Promise<CollectResult> => {
  const empty: CollectResult = { ok: true, skipped: true, channel: null, days: 0, posts: 0 };
  if (instagramConfig() === null) return empty;
  const admin = adminClient();
  const { data, error } = await admin.rpc("metrics_collect_targets");
  const targets = targetsSchema.safeParse(data);
  if (error || !targets.success) {
    logError("collect metrics: could not list the channels", error?.code ?? "invalid_output");
    return { ...empty, ok: false, skipped: false };
  }
  const next = targets.data.find(isDue);
  return next === undefined ? empty : collectChannel(admin, next);
};
