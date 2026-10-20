import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Camera,
  Hammer,
  Hourglass,
  Lightbulb,
  Send,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import { editorialStyle } from "@/components/shared/content/status-styles";
import { entryDay, entryTime } from "@/lib/shared/calendar/entries";
import { type GridItem, StatusMark } from "@/lib/shared/calendar/grid-item";
import type { CalendarEntry } from "@/lib/shared/calendar/types";
import {
  type CalendarAlert,
  CalendarEntryKind,
  CalendarEventType,
  PublicationStatus,
} from "@/lib/shared/enums";
import {
  calendarAlertLabels,
  calendarEntryKindLabels,
  editorialStatusLabels,
  platformLabels,
} from "@/lib/shared/labels";

const kindIcons: Record<CalendarEntryKind, LucideIcon> = {
  [CalendarEntryKind.Publication]: CalendarClock,
  [CalendarEntryKind.Published]: Send,
  [CalendarEntryKind.ApprovalDeadline]: Hourglass,
  [CalendarEntryKind.ProductionDeadline]: Hammer,
  [CalendarEntryKind.Idea]: Lightbulb,
  [CalendarEntryKind.Date]: CalendarDays,
  [CalendarEntryKind.Event]: CalendarRange,
};

const eventIcons: Record<CalendarEventType, LucideIcon> = {
  [CalendarEventType.Shoot]: Camera,
  [CalendarEventType.Meeting]: UsersRound,
  [CalendarEventType.Other]: CalendarRange,
};

export const eventIconOf = (type: CalendarEventType | null): LucideIcon =>
  type === null ? CalendarDays : eventIcons[type];

const deadlineTones: Partial<Record<CalendarEntryKind, StatusTone>> = {
  [CalendarEntryKind.ApprovalDeadline]: "warning",
  [CalendarEntryKind.ProductionDeadline]: "neutral",
  [CalendarEntryKind.Published]: "success",
  [CalendarEntryKind.Idea]: "warning",
  [CalendarEntryKind.Date]: "info",
  [CalendarEntryKind.Event]: "info",
};

const isNote = (entry: CalendarEntry): boolean =>
  entry.kind === CalendarEntryKind.Idea ||
  entry.kind === CalendarEntryKind.Date ||
  entry.kind === CalendarEntryKind.Event;

const markOf = (entry: CalendarEntry): StatusMark | null => {
  if (entry.clientVisible) return StatusMark.Shared;
  if (isNote(entry)) return entry.convertedItemId === null ? null : StatusMark.Converted;
  if (entry.kind === CalendarEntryKind.Published) return StatusMark.Published;
  if (entry.kind === CalendarEntryKind.Publication) {
    return entry.publicationStatus === PublicationStatus.Planned ? StatusMark.Scheduled : null;
  }
  return null;
};

export const entrySubtitle = (entry: CalendarEntry, zone: string): string => {
  const channel =
    entry.platform === null
      ? null
      : `${platformLabels[entry.platform]}${entry.profileName ? ` ${entry.profileName}` : ""}`;
  const own =
    entry.plannedTimezone !== null && entry.plannedTimezone !== zone
      ? entry.plannedTimezone.replaceAll("_", " ")
      : null;
  return [entry.brandName, channel, own].filter((part) => part !== null).join(" · ");
};

export const toGridItem = (
  entry: CalendarEntry,
  zone: string,
  alerts: CalendarAlert[],
  movable: boolean,
  key: string,
): GridItem | null => {
  const day = entryDay(entry, zone);
  if (day === null) return null;
  const style =
    entry.editorialStatus === null || entry.kind !== CalendarEntryKind.Publication
      ? null
      : editorialStyle(entry.editorialStatus);
  return {
    key,
    day,
    time: entryTime(entry, zone) ?? "",
    title: entry.title,
    subtitle: entrySubtitle(entry, zone),
    kindLabel: calendarEntryKindLabels[entry.kind],
    statusLabel:
      entry.kind === CalendarEntryKind.Publication && entry.editorialStatus !== null
        ? editorialStatusLabels[entry.editorialStatus]
        : isNote(entry) && entry.convertedItemId !== null
          ? "Convertida em conteúdo"
          : entry.clientVisible
            ? "Visível para o cliente"
            : calendarEntryKindLabels[entry.kind],
    tone: style?.tone ?? deadlineTones[entry.kind] ?? "neutral",
    icon:
      entry.kind === CalendarEntryKind.Event && entry.eventType !== null
        ? eventIcons[entry.eventType]
        : kindIcons[entry.kind],
    movable,
    alerts: alerts.map((alert) => calendarAlertLabels[alert]),
    platform: entry.platform,
    mark: markOf(entry),
    muted: isNote(entry) && entry.convertedItemId !== null,
  };
};
