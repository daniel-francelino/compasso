import { z } from "zod";
import {
  CalendarEventType,
  CalendarNoteKind,
  CalendarNoteRepeat,
  EditorialStatus,
  PublicationStatus,
} from "@/lib/shared/enums";

const isoInstant = z
  .string({ required_error: "Informe a data e a hora." })
  .datetime({ offset: true, message: "Informe a data e a hora." });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

export const calendarRequestSchema = z.object({
  from: isoInstant,
  to: isoInstant,
  brandId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  editorial: z.nativeEnum(EditorialStatus).optional(),
  publication: z.nativeEnum(PublicationStatus).optional(),
  notes: z.array(z.nativeEnum(CalendarNoteKind)).max(3).optional(),
});

export type CalendarRequest = z.infer<typeof calendarRequestSchema>;

export const rescheduleSchema = z.object({
  channelRowId: z.string().uuid(),
  plannedAt: isoInstant,
  timezone: z.string().min(1, "Informe o fuso horário.").max(60),
  expectedVersion: z.number().int().min(1),
});

export const deadlineSchema = z.object({
  itemId: z.string().uuid(),
  date: dateOnly,
  expectedVersion: z.number().int().min(1),
});

export const saveNoteSchema = z
  .object({
    id: z.string().uuid().optional(),
    brandId: z.string().uuid({ message: "Escolha a marca." }),
    kind: z.nativeEnum(CalendarNoteKind),
    title: z
      .string()
      .trim()
      .min(2, "O título precisa ter ao menos 2 letras.")
      .max(140, "O título é longo demais."),
    description: z.string().trim().max(2000, "A descrição é longa demais.").optional(),
    noteDate: dateOnly,
    endDate: dateOnly.nullable().optional(),
    repeat: z.nativeEnum(CalendarNoteRepeat),
    eventType: z.nativeEnum(CalendarEventType).nullable().optional(),
    allDay: z.boolean().default(true),
    startsAt: isoInstant.nullable().optional(),
    endsAt: isoInstant.nullable().optional(),
    timezone: z.string().trim().max(60).nullable().optional(),
    location: z.string().trim().max(200, "O local é longo demais.").optional(),
    clientVisible: z.boolean().default(false),
    internalNotes: z.string().trim().max(4000, "As notas são longas demais.").optional(),
    expectedVersion: z.number().int().min(1).optional(),
  })
  .refine((value) => value.id === undefined || value.expectedVersion !== undefined, {
    message: "Recarregue a página para continuar.",
    path: ["expectedVersion"],
  })
  .refine((value) => value.kind !== CalendarNoteKind.Event || value.eventType, {
    message: "Escolha o tipo do evento.",
    path: ["eventType"],
  })
  .refine(
    (value) =>
      value.kind !== CalendarNoteKind.Event ||
      value.allDay ||
      (value.startsAt && value.endsAt && value.endsAt >= value.startsAt),
    { message: "Informe o início e o fim do evento.", path: ["startsAt"] },
  )
  .refine((value) => !value.location || !/^http:\/\//i.test(value.location), {
    message: "O link precisa começar com https://",
    path: ["location"],
  });

export type SaveNoteInput = z.infer<typeof saveNoteSchema>;

export const noteIdSchema = z.object({ id: z.string().uuid() });
