import { sendEmail } from "@/lib/shared/email/email.server";
import {
  OUTBOX_BATCH,
  nextAttemptAt,
  outboxPayloadSchema,
  statusAfterFailure,
} from "@/lib/shared/email/outbox";
import { notificationEmail } from "@/lib/shared/email/templates";
import { logError } from "@/lib/shared/logger";
import { adminClient } from "@/lib/shared/supabase/admin.server";

export type OutboxResult = { sent: number; retried: number; failed: number; ok: boolean };

export const processEmailOutbox = async (origin: string): Promise<OutboxResult> => {
  const client = adminClient();
  const now = new Date();
  const { data: rows, error } = await client
    .from("email_outbox")
    .select("id, to_email, payload, attempts")
    .eq("status", "queued")
    .lte("next_attempt_at", now.toISOString())
    .order("created_at")
    .limit(OUTBOX_BATCH);
  if (error) {
    logError("email outbox: could not read the queue", error.code);
    return { sent: 0, retried: 0, failed: 0, ok: false };
  }

  const result: OutboxResult = { sent: 0, retried: 0, failed: 0, ok: true };
  for (const row of rows) {
    const payload = outboxPayloadSchema.safeParse(row.payload);
    const attempts = row.attempts + 1;
    const outcome = payload.success
      ? await sendEmail(
          notificationEmail({
            to: row.to_email,
            title: payload.data.title,
            link: payload.data.link ?? null,
            origin,
          }),
        )
      : ({ ok: false, reason: "invalid_payload" } as const);

    if (outcome.ok) {
      await client.from("email_outbox").update({ status: "sent", attempts }).eq("id", row.id);
      result.sent += 1;
      continue;
    }
    const status = payload.success ? statusAfterFailure(attempts) : "failed";
    await client
      .from("email_outbox")
      .update({
        status,
        attempts,
        last_error: outcome.reason,
        next_attempt_at: nextAttemptAt(attempts, now).toISOString(),
      })
      .eq("id", row.id);
    if (status === "failed") result.failed += 1;
    else result.retried += 1;
  }
  return result;
};
