import { z } from "zod";
import { CalendarView, EditorialStatus, PublicationStatus } from "@/lib/shared/enums";

const optionalUuid = z.string().uuid().optional().catch(undefined);

export const calendarSearchSchema = z.object({
  view: z.nativeEnum(CalendarView).optional().catch(undefined),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  zone: z.string().max(60).optional().catch(undefined),
  brand: optionalUuid,
  channel: optionalUuid,
  owner: optionalUuid,
  editorial: z.nativeEnum(EditorialStatus).optional().catch(undefined),
  publication: z.nativeEnum(PublicationStatus).optional().catch(undefined),
  deadlines: z.boolean().optional().catch(undefined),
  ideas: z.boolean().optional().catch(undefined),
  dates: z.boolean().optional().catch(undefined),
});

export type CalendarSearch = z.infer<typeof calendarSearchSchema>;

export const portalCalendarSearchSchema = z.object({
  view: z.nativeEnum(CalendarView).optional().catch(undefined),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

export type PortalCalendarSearch = z.infer<typeof portalCalendarSearchSchema>;
