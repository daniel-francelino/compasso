import type {
  ApprovalRequestStatus,
  ApprovalStage,
  CalendarEntryKind,
  CalendarEventType,
  CalendarNoteKind,
  CalendarNoteRepeat,
  ContentFormat,
  EditorialStatus,
  Platform,
  PublicationStatus,
} from "@/lib/shared/enums";

export type CalendarEntry = {
  kind: CalendarEntryKind;
  itemId: string | null;
  channelRowId: string | null;
  noteId: string | null;
  description: string | null;
  repeat: CalendarNoteRepeat | null;
  convertedItemId: string | null;
  eventType: CalendarEventType | null;
  allDay: boolean;
  endDate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  location: string | null;
  clientVisible: boolean;
  internalNotes: string | null;
  noteVersion: number | null;
  requestId: string | null;
  title: string;
  brandId: string;
  brandName: string;
  brandTimezone: string;
  channelId: string | null;
  platform: Platform | null;
  profileName: string | null;
  format: ContentFormat | null;
  editorialStatus: EditorialStatus | null;
  publicationStatus: PublicationStatus | null;
  plannedTimezone: string | null;
  at: string | null;
  date: string | null;
  version: number | null;
  itemVersion: number | null;
  assigneeName: string | null;
  channelArchived: boolean;
};

export type PortalCalendarEntry = {
  requestId: string;
  status: ApprovalRequestStatus;
  title: string;
  platform: Platform;
  profileName: string;
  plannedAt: string;
  plannedTimezone: string;
  brandTimezone: string;
  stage: ApprovalStage;
};

export type PortalCalendarEvent = {
  noteId: string;
  kind: CalendarNoteKind;
  eventType: CalendarEventType | null;
  title: string;
  description: string | null;
  date: string;
  endDate: string | null;
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  location: string | null;
};

export type VisibleRange = { start: string; end: string; days: string[] };
