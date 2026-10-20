import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { noteIdSchema, saveNoteSchema } from "@/lib/marketing/calendar/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { CalendarEventType, CalendarNoteKind, CalendarNoteRepeat } from "@/lib/shared/enums";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

export type CalendarNote = {
  id: string;
  brandId: string;
  kind: CalendarNoteKind;
  title: string;
  description: string | null;
  noteDate: string;
  endDate: string | null;
  repeat: CalendarNoteRepeat;
  convertedItemId: string | null;
  eventType: CalendarEventType | null;
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  location: string | null;
  clientVisible: boolean;
  internalNotes: string | null;
  archived: boolean;
  version: number;
};

const savedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });

const noteSchema = z.object({
  id: z.string().uuid(),
  brand_id: z.string().uuid(),
  kind: z.nativeEnum(CalendarNoteKind),
  title: z.string(),
  description: z.string().nullable(),
  note_date: z.string(),
  end_date: z.string().nullable(),
  repeat: z.nativeEnum(CalendarNoteRepeat),
  converted_item_id: z.string().uuid().nullable(),
  event_type: z.nativeEnum(CalendarEventType).nullable(),
  all_day: z.boolean(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  timezone: z.string().nullable(),
  location: z.string().nullable(),
  client_visible: z.boolean(),
  internal_notes: z.string().nullable(),
  archived: z.boolean(),
  version: z.number().int(),
});

export const saveCalendarNote = createServerFn({ method: "POST" })
  .validator(saveNoteSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(Action.Calendar.Manage);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("calendar_note_save", {
      p_note: {
        ...(data.id === undefined ? {} : { id: data.id }),
        brand_id: data.brandId,
        kind: data.kind,
        title: data.title,
        description: data.description ?? null,
        note_date: data.noteDate,
        end_date: data.endDate ?? null,
        repeat: data.repeat,
        event_type: data.eventType ?? null,
        all_day: data.allDay,
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        timezone: data.timezone ?? null,
        location: data.location ?? null,
        client_visible: data.clientVisible,
        internal_notes: data.internalNotes ?? null,
        ...(data.expectedVersion === undefined ? {} : { expected_version: data.expectedVersion }),
      },
    });
    if (error) return fail(error);
    const saved = parseOutput(savedSchema, row);
    return saved.ok ? { ok: true, id: saved.id, version: saved.version } : saved;
  });

export const archiveCalendarNote = createServerFn({ method: "POST" })
  .validator(noteIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Calendar.Manage);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("calendar_note_archive", { p_note: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const getCalendarNote = createServerFn({ method: "GET" })
  .validator(noteIdSchema)
  .handler(async ({ data }): Promise<Result<{ note: CalendarNote }>> => {
    const caller = await requireActionServer(Action.Calendar.View);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("calendar_note_get", {
      p_note: data.id,
    });
    if (error) return fail(error);
    const parsed = parseOutput(noteSchema, row);
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      note: {
        id: parsed.id,
        brandId: parsed.brand_id,
        kind: parsed.kind,
        title: parsed.title,
        description: parsed.description,
        noteDate: parsed.note_date,
        endDate: parsed.end_date,
        repeat: parsed.repeat,
        convertedItemId: parsed.converted_item_id,
        eventType: parsed.event_type,
        allDay: parsed.all_day,
        startsAt: parsed.starts_at,
        endsAt: parsed.ends_at,
        timezone: parsed.timezone,
        location: parsed.location,
        clientVisible: parsed.client_visible,
        internalNotes: parsed.internal_notes,
        archived: parsed.archived,
        version: parsed.version,
      },
    };
  });
