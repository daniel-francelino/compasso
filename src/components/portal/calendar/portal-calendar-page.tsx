import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, RotateCw } from "lucide-react";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { CalendarGrid } from "@/components/shared/calendar/calendar-grid";
import { CalendarList } from "@/components/shared/calendar/calendar-list";
import { CalendarToolbar } from "@/components/shared/calendar/calendar-toolbar";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { requestStyle } from "@/components/shared/content/status-styles";
import { Alert, AlertDescription } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import { useCalendarState } from "@/hooks/shared/use-calendar-state";
import { listPortalCalendar } from "@/lib/portal/calendar/portal-calendar.functions";
import type { GridItem } from "@/lib/shared/calendar/grid-item";
import { rangeTitle } from "@/lib/shared/calendar/range";
import type { PortalCalendarEntry } from "@/lib/shared/calendar/types";
import { ApprovalRequestStatus, CalendarView } from "@/lib/shared/enums";
import { instantToLocalInput, todayInZone } from "@/lib/shared/format";
import { approvalRequestStatusLabels, platformLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const LEGEND = [
  ApprovalRequestStatus.Pending,
  ApprovalRequestStatus.Approved,
  ApprovalRequestStatus.ChangesRequested,
  ApprovalRequestStatus.Superseded,
];

const requestZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const toItem = (entry: PortalCalendarEntry, zone: string): GridItem => {
  const style = requestStyle(entry.status);
  const local = instantToLocalInput(entry.plannedAt, zone);
  const own =
    entry.plannedTimezone !== zone ? ` · ${entry.plannedTimezone.replaceAll("_", " ")}` : "";
  return {
    key: entry.requestId,
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
  };
};

export function PortalCalendarPage({ brandId }: { brandId: string }) {
  const navigate = useNavigate();
  const state = useCalendarState(requestZone());
  const request = { brandId, from: state.from.toISOString(), to: state.to.toISOString() };
  const query = useQuery({
    queryKey: QueryKey.Portal.calendar(brandId, request),
    queryFn: async () => unwrapResult(await listPortalCalendar({ data: request })),
    placeholderData: keepPreviousData,
  });

  const zone = query.data?.brandTimezone ?? requestZone();
  const items = (query.data?.entries ?? [])
    .map((entry) => toItem(entry, zone))
    .filter((item) => item.day >= state.range.start && item.day < state.range.end);
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
        <CalendarList
          items={items}
          onSelect={(key) =>
            void navigate({
              to: "/portal/brands/$brandId/approvals/$requestId",
              params: { brandId, requestId: key },
            })
          }
        />
      ) : (
        <CalendarGrid
          label={`Calendário, ${title}`}
          days={state.range.days}
          items={items}
          today={todayInZone(zone)}
          month={state.view === CalendarView.Month ? state.anchor.slice(0, 7) : null}
          compact={state.view === CalendarView.Month}
          onSelect={(key) =>
            void navigate({
              to: "/portal/brands/$brandId/approvals/$requestId",
              params: { brandId, requestId: key },
            })
          }
          onOpenDay={(day) => void state.openDay(day)}
        />
      )}
      <ul className="flex flex-wrap gap-2" aria-label="Legenda">
        {LEGEND.map((status) => (
          <li key={status}>
            <RequestStatusBadge status={status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
