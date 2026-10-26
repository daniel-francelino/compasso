import { z } from "zod";
import { type InstagramConfig, instagramConfig } from "@/lib/shared/env.server";
import {
  type AdminClient,
  markConnectionLost,
  readConnectionSecret,
} from "@/lib/shared/jobs/connection-token.server";
import { logError } from "@/lib/shared/logger";
import {
  ContainerStatus,
  checkRequest,
  getContainerStatus,
  getPermalink,
  getPublishingQuota,
  publishContainer,
  startPublication,
} from "@/lib/shared/social/instagram-publish.server";
import { PublishErrorCode } from "@/lib/shared/social/publish-codes";
import { serverStorage } from "@/lib/shared/storage/server-storage.server";
import type { ServerStorage } from "@/lib/shared/storage/types";
import { adminClient } from "@/lib/shared/supabase/admin.server";

const CLAIM_LIMIT = 3;
const LATE_HOURS = 6;
const SIGN_SECONDS = 900;
const STUCK_MS = 30 * 60 * 1000;
const BUDGET_MS = 8000;

const attemptSchema = z.object({
  id: z.string().uuid(),
  no: z.number().int(),
  status: z.string(),
  container_id: z.string().nullable(),
  created_at: z.string(),
});

const itemSchema = z.object({
  row_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  channel_id: z.string().uuid(),
  item_id: z.string().uuid(),
  format: z.string(),
  caption: z.string(),
  external_account_id: z.string(),
  attempt: attemptSchema,
  media: z.array(
    z.object({
      media_version_id: z.string().uuid(),
      position: z.number().int(),
      mime_type: z.string(),
      storage_key: z.string(),
      size_bytes: z.number().nullable(),
      available: z.boolean(),
    }),
  ),
});

const workSchema = z.object({ claimed: z.array(itemSchema), inflight: z.array(itemSchema) });

type WorkItem = z.infer<typeof itemSchema>;

type Context = { admin: AdminClient; config: InstagramConfig; storage: ServerStorage };

export type PublishDueResult = {
  ok: boolean;
  skipped: boolean;
  started: number;
  published: number;
  failed: number;
  waiting: number;
};

type Failure = { code: PublishErrorCode; provider: string; transient: boolean };

type Outcome = "started" | "published" | "failed" | "waiting";

const markFailed = async (
  context: Context,
  item: WorkItem,
  failure: Pick<Failure, "code" | "provider">,
  uncertain = false,
): Promise<Outcome> => {
  await context.admin.rpc("publish_row_failed", {
    p_attempt: item.attempt.id,
    p_code: failure.code,
    p_provider: failure.provider,
    p_uncertain: uncertain,
  });
  return "failed";
};

const release = async (context: Context, item: WorkItem, code: PublishErrorCode) => {
  await context.admin.rpc("publish_row_release", { p_attempt: item.attempt.id, p_code: code });
  return "waiting" as const;
};

const isStuck = (item: WorkItem): boolean =>
  Date.now() - Date.parse(item.attempt.created_at) > STUCK_MS;

const handleFailure = async (
  context: Context,
  item: WorkItem,
  failure: Failure,
): Promise<Outcome> => {
  if (failure.code === PublishErrorCode.ConnectionExpired) {
    await markConnectionLost(context.admin, item.channel_id);
    return markFailed(context, item, failure);
  }
  if (failure.code === PublishErrorCode.LimitReached) {
    return release(context, item, PublishErrorCode.LimitReached);
  }
  if (!failure.transient) return markFailed(context, item, failure);
  if (isStuck(item)) {
    return markFailed(context, item, { code: PublishErrorCode.Stuck, provider: failure.provider });
  }
  return "waiting";
};

const begin = async (context: Context, item: WorkItem): Promise<Outcome> => {
  const secret = await readConnectionSecret(context.admin, context.config, item.channel_id);
  if (!secret.ok) return markFailed(context, item, { code: secret.code, provider: "secret" });
  const { token, accountId } = secret.secret;

  const ordered = [...item.media].sort((left, right) => left.position - right.position);
  const signed = await context.storage.signUrls(
    ordered.map((media) => media.storage_key),
    SIGN_SECONDS,
  );
  const media = ordered.map((entry) => ({
    mimeType: entry.mime_type,
    sizeBytes: entry.size_bytes,
    url: signed.get(entry.storage_key) ?? "",
  }));
  const request = { format: item.format, caption: item.caption, media };
  const unavailable = ordered.some((entry) => !entry.available) || media.some((m) => m.url === "");
  const check = unavailable
    ? ({ ok: false, code: PublishErrorCode.MediaNotReady } as const)
    : checkRequest(request);
  if (!check.ok) return markFailed(context, item, { code: check.code, provider: "preflight" });

  const quota = await getPublishingQuota(token, accountId);
  if (quota.ok && quota.data.total !== null && quota.data.used >= quota.data.total) {
    return release(context, item, PublishErrorCode.LimitReached);
  }

  const created = await startPublication(token, accountId, request);
  if (!created.ok) return handleFailure(context, item, created);
  await context.admin.rpc("publish_attempt_set", {
    p_attempt: item.attempt.id,
    p_status: "container_created",
    p_container: created.data.id,
    p_error: null,
    p_provider: null,
  });
  return "started";
};

const finish = async (context: Context, item: WorkItem, containerId: string): Promise<Outcome> => {
  const secret = await readConnectionSecret(context.admin, context.config, item.channel_id);
  if (!secret.ok) return markFailed(context, item, { code: secret.code, provider: "secret" });
  const { token, accountId } = secret.secret;

  const status = await getContainerStatus(token, containerId);
  if (!status.ok) return handleFailure(context, item, status);
  if (status.data.status === ContainerStatus.InProgress) {
    return isStuck(item)
      ? markFailed(context, item, { code: PublishErrorCode.Stuck, provider: "in_progress" })
      : "waiting";
  }
  if (status.data.status === ContainerStatus.Published) {
    return markFailed(
      context,
      item,
      { code: PublishErrorCode.Uncertain, provider: "published" },
      true,
    );
  }
  if (status.data.status !== ContainerStatus.Finished) {
    return markFailed(context, item, {
      code: PublishErrorCode.MediaNotReady,
      provider: status.data.status,
    });
  }

  const published = await publishContainer(token, accountId, containerId);
  if (!published.ok) {
    return published.transient
      ? markFailed(context, item, published, true)
      : handleFailure(context, item, published);
  }
  const link = await getPermalink(token, published.data.id);
  await context.admin.rpc("publish_row_complete", {
    p_attempt: item.attempt.id,
    p_media_id: published.data.id,
    p_permalink: link.ok ? link.data.permalink : "",
  });
  return "published";
};

const advance = (context: Context, item: WorkItem): Promise<Outcome> =>
  item.attempt.container_id === null
    ? begin(context, item)
    : finish(context, item, item.attempt.container_id);

export const runPublishDue = async (): Promise<PublishDueResult> => {
  const result: PublishDueResult = {
    ok: true,
    skipped: false,
    started: 0,
    published: 0,
    failed: 0,
    waiting: 0,
  };
  const config = instagramConfig();
  const storage = serverStorage();
  if (config === null || storage === null) return { ...result, skipped: true };

  const admin = adminClient();
  const { data, error } = await admin.rpc("publish_work", {
    p_limit: CLAIM_LIMIT,
    p_late_hours: LATE_HOURS,
  });
  const work = workSchema.safeParse(data);
  if (error || !work.success) {
    logError("publish due: could not read the work list", error?.code ?? "invalid_output");
    return { ...result, ok: false };
  }

  const context: Context = { admin, config, storage };
  const startedAt = Date.now();
  for (const item of [...work.data.inflight, ...work.data.claimed]) {
    if (Date.now() - startedAt > BUDGET_MS) break;
    const outcome = await advance(context, item);
    if (outcome === "started") result.started += 1;
    if (outcome === "published") result.published += 1;
    if (outcome === "failed") result.failed += 1;
    if (outcome === "waiting") result.waiting += 1;
  }
  return result;
};
