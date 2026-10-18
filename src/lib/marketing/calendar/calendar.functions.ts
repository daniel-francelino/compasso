import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  calendarRequestSchema,
  deadlineSchema,
  rescheduleSchema,
} from "@/lib/marketing/calendar/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import type { CalendarEntry, UndatedEntry } from "@/lib/shared/calendar/types";
import {
  CalendarEntryKind,
  ContentFormat,
  EditorialStatus,
  Platform,
  PublicationStatus,
} from "@/lib/shared/enums";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

const commonShape = {
  item_id: z.string().uuid(),
  title: z.string(),
  brand_id: z.string().uuid(),
  brand_name: z.string(),
  brand_timezone: z.string(),
  item_version: z.number().int(),
  assignee_name: z.string().nullable(),
  channel_archived: z.boolean(),
};

const entrySchema = z.object({
  ...commonShape,
  kind: z.nativeEnum(CalendarEntryKind),
  variant_id: z.string().uuid().nullable(),
  request_id: z.string().uuid().nullable().optional(),
  channel_id: z.string().uuid().nullable(),
  platform: z.nativeEnum(Platform).nullable(),
  profile_name: z.string().nullable(),
  format: z.nativeEnum(ContentFormat).nullable(),
  editorial_status: z.nativeEnum(EditorialStatus).nullable(),
  publication_status: z.nativeEnum(PublicationStatus).nullable(),
  planned_timezone: z.string().nullable(),
  at: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  version: z.number().int().nullable(),
});

const undatedSchema = z.object({
  ...commonShape,
  variant_id: z.string().uuid(),
  channel_id: z.string().uuid(),
  platform: z.nativeEnum(Platform),
  profile_name: z.string(),
  format: z.nativeEnum(ContentFormat),
  editorial_status: z.nativeEnum(EditorialStatus),
  version: z.number().int(),
});

const listSchema = z.object({
  entries: z.array(entrySchema),
  undated: z.array(undatedSchema),
  truncated: z.boolean(),
});

const rescheduledSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  resubmitted: z.boolean(),
});

const deadlineSavedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });

export type CalendarData = {
  entries: CalendarEntry[];
  undated: UndatedEntry[];
  truncated: boolean;
};

const toEntry = (row: z.infer<typeof entrySchema>): CalendarEntry => ({
  kind: row.kind,
  itemId: row.item_id,
  variantId: row.variant_id,
  requestId: row.request_id ?? null,
  title: row.title,
  brandId: row.brand_id,
  brandName: row.brand_name,
  brandTimezone: row.brand_timezone,
  channelId: row.channel_id,
  platform: row.platform,
  profileName: row.profile_name,
  format: row.format,
  editorialStatus: row.editorial_status,
  publicationStatus: row.publication_status,
  plannedTimezone: row.planned_timezone,
  at: row.at ?? null,
  date: row.date ?? null,
  version: row.version,
  itemVersion: row.item_version,
  assigneeName: row.assignee_name,
  channelArchived: row.channel_archived,
});

const toUndated = (row: z.infer<typeof undatedSchema>): UndatedEntry => ({
  itemId: row.item_id,
  variantId: row.variant_id,
  title: row.title,
  brandId: row.brand_id,
  brandName: row.brand_name,
  brandTimezone: row.brand_timezone,
  channelId: row.channel_id,
  platform: row.platform,
  profileName: row.profile_name,
  format: row.format,
  editorialStatus: row.editorial_status,
  version: row.version,
  assigneeName: row.assignee_name,
  channelArchived: row.channel_archived,
});

export const listCalendarEntries = createServerFn({ method: "GET" })
  .validator(calendarRequestSchema)
  .handler(async ({ data }): Promise<Result<CalendarData>> => {
    const caller = await requireActionServer(Action.Calendar.View);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("list_calendar_entries", {
      p_from: data.from,
      p_to: data.to,
      ...(data.brandId ? { p_brands: [data.brandId] } : {}),
      ...(data.channelId ? { p_channels: [data.channelId] } : {}),
      ...(data.ownerId ? { p_assignee: data.ownerId } : {}),
      ...(data.editorial ? { p_editorial: [data.editorial] } : {}),
      ...(data.publication ? { p_publication: [data.publication] } : {}),
    });
    if (error) return fail(error);
    const parsed = parseOutput(listSchema, row);
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      entries: parsed.entries.map(toEntry),
      undated: parsed.undated.map(toUndated),
      truncated: parsed.truncated,
    };
  });

export const getCalendarZone = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ timezone: string }>> => {
    const caller = await requireActionServer(Action.Calendar.View);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase
      .from("organizations")
      .select("default_timezone")
      .limit(1)
      .single();
    if (error) return fail(error);
    return { ok: true, timezone: data.default_timezone };
  },
);

export const rescheduleVariant = createServerFn({ method: "POST" })
  .validator(rescheduleSchema)
  .handler(async ({ data }): Promise<Result<{ version: number; resubmitted: boolean }>> => {
    const caller = await requireActionServer(Action.Calendar.Manage);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("reschedule_variant", {
      p_variant: data.variantId,
      p_planned_at: data.plannedAt,
      p_timezone: data.timezone,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    const parsed = parseOutput(rescheduledSchema, row);
    if (!parsed.ok) return parsed;
    return { ok: true, version: parsed.version, resubmitted: parsed.resubmitted };
  });

export const rescheduleProductionDeadline = createServerFn({ method: "POST" })
  .validator(deadlineSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Calendar.Manage);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("reschedule_production_deadline", {
      p_item: data.itemId,
      p_date: data.date,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    const parsed = parseOutput(deadlineSavedSchema, row);
    return parsed.ok ? { ok: true, version: parsed.version } : parsed;
  });
