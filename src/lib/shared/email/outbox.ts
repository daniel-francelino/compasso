import { z } from "zod";
import { plusMinutes } from "@/lib/shared/dates";

export const MAX_EMAIL_ATTEMPTS = 5;
export const OUTBOX_BATCH = 20;
const BASE_BACKOFF_MINUTES = 5;

export const outboxPayloadSchema = z.object({
  title: z.string().min(1).max(300),
  link: z
    .string()
    .regex(/^\/[^/]/)
    .nullable()
    .optional(),
});

export const backoffMinutes = (attempts: number): number =>
  BASE_BACKOFF_MINUTES * 2 ** Math.max(0, attempts - 1);

export const nextAttemptAt = (attempts: number, now: Date): Date =>
  plusMinutes(now, backoffMinutes(attempts));

export const statusAfterFailure = (attempts: number): "queued" | "failed" =>
  attempts >= MAX_EMAIL_ATTEMPTS ? "failed" : "queued";
