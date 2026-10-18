import { CalendarClock, Hammer, Hourglass, Send, type LucideIcon } from "lucide-react";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import { editorialStyle } from "@/components/shared/content/status-styles";
import { entryDay, entryTime } from "@/lib/shared/calendar/entries";
import type { GridItem } from "@/lib/shared/calendar/grid-item";
import type { CalendarEntry } from "@/lib/shared/calendar/types";
import { type CalendarAlert, CalendarEntryKind } from "@/lib/shared/enums";
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
};

const deadlineTones: Partial<Record<CalendarEntryKind, StatusTone>> = {
  [CalendarEntryKind.ApprovalDeadline]: "warning",
  [CalendarEntryKind.ProductionDeadline]: "neutral",
  [CalendarEntryKind.Published]: "success",
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
        : calendarEntryKindLabels[entry.kind],
    tone: style?.tone ?? deadlineTones[entry.kind] ?? "neutral",
    icon: kindIcons[entry.kind],
    movable,
    alerts: alerts.map((alert) => calendarAlertLabels[alert]),
  };
};
