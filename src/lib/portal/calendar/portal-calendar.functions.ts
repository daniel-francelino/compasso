import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import type { PortalCalendarEntry, PortalCalendarEvent } from "@/lib/shared/calendar/types";
import {
  ApprovalRequestStatus,
  ApprovalStage,
  CalendarEventType,
  CalendarNoteKind,
  Platform,
} from "@/lib/shared/enums";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

const requestSchema = z.object({
  brandId: z.string().uuid(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

const eventSchema = z.object({
  note_id: z.string().uuid(),
  kind: z.nativeEnum(CalendarNoteKind),
  event_type: z.nativeEnum(CalendarEventType).nullable(),
  title: z.string(),
  description: z.string().nullable(),
  date: z.string(),
  end_date: z.string().nullable(),
  all_day: z.boolean(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  timezone: z.string(),
  location: z.string().nullable(),
});

const listSchema = z.object({
  brand_timezone: z.string(),
  events: z.array(eventSchema),
  entries: z.array(
    z.object({
      request_id: z.string().uuid(),
      status: z.nativeEnum(ApprovalRequestStatus),
      title: z.string(),
      platform: z.nativeEnum(Platform),
      profile_name: z.string(),
      planned_at: z.string(),
      planned_timezone: z.string(),
      brand_timezone: z.string(),
      stage: z.nativeEnum(ApprovalStage),
    }),
  ),
});

export const listPortalCalendar = createServerFn({ method: "GET" })
  .validator(requestSchema)
  .handler(
    async ({
      data,
    }): Promise<
      Result<{
        brandTimezone: string;
        entries: PortalCalendarEntry[];
        events: PortalCalendarEvent[];
      }>
    > => {
      const caller = await requireActionServer(Action.Portal.View);
      if (caller === null) return denied;
      const { data: rows, error } = await caller.supabase.rpc("portal_list_calendar", {
        p_brand: data.brandId,
        p_from: data.from,
        p_to: data.to,
      });
      if (error) return fail(error);
      const parsed = parseOutput(listSchema, rows);
      if (!parsed.ok) return parsed;
      return {
        ok: true,
        brandTimezone: parsed.brand_timezone,
        events: parsed.events.map((row) => ({
          noteId: row.note_id,
          kind: row.kind,
          eventType: row.event_type,
          title: row.title,
          description: row.description,
          date: row.date,
          endDate: row.end_date,
          allDay: row.all_day,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          timezone: row.timezone,
          location: row.location,
        })),
        entries: parsed.entries.map((row) => ({
          requestId: row.request_id,
          status: row.status,
          title: row.title,
          platform: row.platform,
          profileName: row.profile_name,
          plannedAt: row.planned_at,
          plannedTimezone: row.planned_timezone,
          brandTimezone: row.brand_timezone,
          stage: row.stage,
        })),
      };
    },
  );
