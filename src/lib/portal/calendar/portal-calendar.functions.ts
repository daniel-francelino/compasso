import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import type { PortalCalendarEntry } from "@/lib/shared/calendar/types";
import { ApprovalRequestStatus, ApprovalStage, Platform } from "@/lib/shared/enums";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

const requestSchema = z.object({
  brandId: z.string().uuid(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

const listSchema = z.object({
  brand_timezone: z.string(),
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
    }): Promise<Result<{ brandTimezone: string; entries: PortalCalendarEntry[] }>> => {
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
