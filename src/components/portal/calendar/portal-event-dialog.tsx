import { Clock, MapPin } from "lucide-react";
import { IconTile } from "@/components/shared/admin/icon-tile";
import { eventIconOf } from "@/components/shared/calendar/entry-items";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import type { PortalCalendarEvent } from "@/lib/shared/calendar/types";
import { CalendarNoteKind } from "@/lib/shared/enums";
import { formatDateOnly, formatInZone } from "@/lib/shared/format";
import { calendarEventTypeLabels, calendarNoteKindLabels } from "@/lib/shared/labels";

const whenOf = (event: PortalCalendarEvent): string => {
  if (!event.allDay && event.startsAt !== null) {
    const start = formatInZone(event.startsAt, event.timezone);
    return event.endsAt === null
      ? start
      : `${start} até ${formatInZone(event.endsAt, event.timezone)}`;
  }
  const day = formatDateOnly(event.date);
  return event.endDate === null ? day : `${day} a ${formatDateOnly(event.endDate)}`;
};

export function PortalEventDialog({
  event,
  onClose,
}: {
  event: PortalCalendarEvent;
  onClose: () => void;
}) {
  const kindLabel =
    event.eventType === null
      ? calendarNoteKindLabels[CalendarNoteKind.Date]
      : calendarEventTypeLabels[event.eventType];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <IconTile icon={eventIconOf(event.eventType)} size="sm" />
            {event.title}
          </DialogTitle>
          <DialogDescription>{kindLabel}</DialogDescription>
        </DialogHeader>
        <dl className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <dt>
              <Clock className="size-4 text-muted-foreground" aria-label="Quando" />
            </dt>
            <dd className="font-medium">{whenOf(event)}</dd>
          </div>
          {event.location ? (
            <div className="flex items-start gap-2">
              <dt>
                <MapPin className="size-4 text-muted-foreground" aria-label="Local" />
              </dt>
              <dd className="min-w-0 break-words">
                {event.location.startsWith("https://") ? (
                  <a
                    href={event.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {event.location}
                  </a>
                ) : (
                  event.location
                )}
              </dd>
            </div>
          ) : null}
          {event.description ? (
            <div>
              <dt className="sr-only">Descrição</dt>
              <dd className="whitespace-pre-wrap">{event.description}</dd>
            </div>
          ) : null}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
