import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { ArrowLeft, CalendarRange, RotateCw } from "lucide-react";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { CalendarGrid } from "@/components/shared/calendar/calendar-grid";
import { CalendarList } from "@/components/shared/calendar/calendar-list";
import { CalendarToolbar } from "@/components/shared/calendar/calendar-toolbar";
import { PortalCalendarEntryPreview } from "@/components/portal/calendar/portal-calendar-entry-preview";
import { PortalEventDialog } from "@/components/portal/calendar/portal-event-dialog";
import { eventIconOf } from "@/components/shared/calendar/entry-items";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { requestStyle } from "@/components/shared/content/status-styles";
import { Alert, AlertDescription } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import { useCalendarState } from "@/hooks/shared/use-calendar-state";
import { listPortalCalendar } from "@/lib/portal/calendar/portal-calendar.functions";
import { type GridItem, StatusMark } from "@/lib/shared/calendar/grid-item";
import { rangeTitle } from "@/lib/shared/calendar/range";
import type { PortalCalendarEntry, PortalCalendarEvent } from "@/lib/shared/calendar/types";
import { ApprovalRequestStatus, CalendarNoteKind, CalendarView } from "@/lib/shared/enums";
import { instantToLocalInput, todayInZone } from "@/lib/shared/format";
import {
  approvalRequestStatusLabels,
  calendarEventTypeLabels,
  calendarNoteKindLabels,
  platformLabels,
} from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const LEGEND = [
  ApprovalRequestStatus.Pending,
  ApprovalRequestStatus.Approved,
  ApprovalRequestStatus.ChangesRequested,
  ApprovalRequestStatus.Superseded,
];

const EVENT_PREFIX = "event:";

const requestOf = (key: string): string => key.split(":")[0] ?? key;

const isEventKey = (key: string): boolean => key.startsWith(EVENT_PREFIX);

const eventKey = (event: PortalCalendarEvent): string =>
  `${EVENT_PREFIX}${event.noteId}:${event.date}`;

const toEventItem = (event: PortalCalendarEvent, zone: string): GridItem => ({
  key: eventKey(event),
  day: event.date,
  time:
    event.allDay || event.startsAt === null
      ? ""
      : instantToLocalInput(event.startsAt, zone).slice(11),
  title: event.title,
  subtitle: event.location ?? "",
  kindLabel:
    event.eventType === null
      ? calendarNoteKindLabels[CalendarNoteKind.Date]
      : calendarEventTypeLabels[event.eventType],
  statusLabel: "Evento da equipe",
  tone: "info",
  icon: eventIconOf(event.eventType),
  movable: false,
  alerts: [],
  platform: null,
  mark: null,
  muted: false,
});

const requestZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const toItem = (entry: PortalCalendarEntry, zone: string): GridItem => {
  const style = requestStyle(entry.status);
  const local = instantToLocalInput(entry.plannedAt, zone);
  const own =
    entry.plannedTimezone !== zone ? ` · ${entry.plannedTimezone.replaceAll("_", " ")}` : "";
  return {
    key: `${entry.requestId}:${entry.profileName}:${entry.plannedAt}`,
    day: local.slice(0, 10),
    time: local.slice(11),
    title: entry.title,
    subtitle: `${platformLabels[entry.platform]} ${entry.profileName}${own}`,
    kindLabel: "Publicação",
    statusLabel: approvalRequestStatusLabels[entry.status],
    tone: style.tone,
    icon: style.icon,
    movable: false,
    alerts: [],
    platform: entry.platform,
    mark: StatusMark.Scheduled,
    muted: false,
  };
};

export function PortalCalendarPage({ brandId }: { brandId: string }) {
  const navigate = useNavigate();
  const [openEvent, setOpenEvent] = useState<PortalCalendarEvent | null>(null);
  const state = useCalendarState(requestZone());
  const request = { brandId, from: state.from.toISOString(), to: state.to.toISOString() };
  const query = useQuery({
    queryKey: QueryKey.Portal.calendar(brandId, request),
    queryFn: async () => unwrapResult(await listPortalCalendar({ data: request })),
    placeholderData: keepPreviousData,
  });

  const zone = query.data?.brandTimezone ?? requestZone();
  const events = query.data?.events ?? [];
  const items = [
    ...(query.data?.entries ?? []).map((entry) => toItem(entry, zone)),
    ...events.map((event) => toEventItem(event, zone)),
  ].filter((item) => item.day >= state.range.start && item.day < state.range.end);

  function select(key: string) {
    if (isEventKey(key)) {
      setOpenEvent(events.find((event) => eventKey(event) === key) ?? null);
      return;
    }
    void navigate({
      to: "/portal/brands/$brandId/approvals/$requestId",
      params: { brandId, requestId: requestOf(key) },
    });
  }

  const renderItem = (item: GridItem, trigger: ReactNode) =>
    isEventKey(item.key) ? (
      trigger
    ) : (
      <PortalCalendarEntryPreview item={item}>{trigger}</PortalCalendarEntryPreview>
    );
  const title = rangeTitle(state.view, state.range, state.anchor);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="heading-page">Calendário</h1>
        <Button asChild variant="outline">
          <Link to="/portal/brands/$brandId" params={{ brandId }}>
            <ArrowLeft aria-hidden="true" />
            Voltar ao painel
          </Link>
        </Button>
      </div>
      <CalendarToolbar
        title={title}
        view={state.view}
        showViews={!state.mobile}
        onViewChange={(view) => void state.setView(view)}
        onPrevious={() => void state.shift(-1)}
        onNext={() => void state.shift(1)}
        onToday={() => void state.goToday()}
      >
        <p className="text-xs text-muted-foreground">
          Horários no fuso {zone.replaceAll("_", " ")}
        </p>
      </CalendarToolbar>
      {query.isPending ? (
        <ListSkeleton rows={4} height="h-32" />
      ) : query.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {query.error.message}
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              <RotateCw aria-hidden="true" />
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      ) : state.view === CalendarView.List ? (
        <CalendarList items={items} renderItem={renderItem} onSelect={select} />
      ) : (
        <CalendarGrid
          label={`Calendário, ${title}`}
          days={state.range.days}
          items={items}
          renderItem={renderItem}
          today={todayInZone(zone)}
          month={state.view === CalendarView.Month ? state.anchor.slice(0, 7) : null}
          compact={state.view === CalendarView.Month}
          onSelect={select}
          onOpenDay={(day) => void state.openDay(day)}
        />
      )}
      <ul className="flex flex-wrap gap-2" aria-label="Legenda">
        {LEGEND.map((status) => (
          <li key={status}>
            <RequestStatusBadge status={status} />
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarRange className="size-3.5" aria-hidden="true" />
          Eventos da equipe (captações, reuniões)
        </li>
      </ul>
      {openEvent ? (
        <PortalEventDialog event={openEvent} onClose={() => setOpenEvent(null)} />
      ) : null}
    </div>
  );
}
