import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { noteIdSchema, saveNoteSchema } from "@/lib/marketing/calendar/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { CalendarNoteKind, CalendarNoteRepeat } from "@/lib/shared/enums";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

export type CalendarNote = {
  id: string;
  brandId: string;
  kind: CalendarNoteKind;
  title: string;
  description: string | null;
  noteDate: string;
  repeat: CalendarNoteRepeat;
  convertedItemId: string | null;
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
  repeat: z.nativeEnum(CalendarNoteRepeat),
  converted_item_id: z.string().uuid().nullable(),
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
        repeat: data.repeat,
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
        repeat: parsed.repeat,
        convertedItemId: parsed.converted_item_id,
        archived: parsed.archived,
        version: parsed.version,
      },
    };
  });
