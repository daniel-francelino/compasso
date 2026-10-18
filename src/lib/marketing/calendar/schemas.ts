import { z } from "zod";
import { EditorialStatus, PublicationStatus } from "@/lib/shared/enums";

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
});

export type CalendarRequest = z.infer<typeof calendarRequestSchema>;

export const rescheduleSchema = z.object({
  variantId: z.string().uuid(),
  plannedAt: isoInstant,
  timezone: z.string().min(1, "Informe o fuso horário.").max(60),
  expectedVersion: z.number().int().min(1),
});

export const deadlineSchema = z.object({
  itemId: z.string().uuid(),
  date: dateOnly,
  expectedVersion: z.number().int().min(1),
});
