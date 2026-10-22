import { CalendarClock, Globe, RotateCw } from "lucide-react";
import { brandSelectOptions } from "@/components/shared/admin/brand-select-options";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useContext, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { IconButton } from "@/components/shared/admin/icon-button";
import { PageHeader } from "@/components/shared/admin/page-header";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { ListFilters } from "@/components/shared/admin/list-filters";
import { CalendarGrid } from "@/components/shared/calendar/calendar-grid";
import { CalendarLegend } from "@/components/shared/calendar/calendar-legend";
import { CalendarList } from "@/components/shared/calendar/calendar-list";
import { CalendarToolbar } from "@/components/shared/calendar/calendar-toolbar";
import { toGridItem } from "@/components/shared/calendar/entry-items";
import { Alert, AlertDescription } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { DayAddMenu } from "@/components/marketing/calendar/day-add-menu";
import { EntryDetails } from "@/components/marketing/calendar/entry-details";
import { ContentEditorPage } from "@/components/marketing/content/content-editor-page";
import { EventDialog } from "@/components/marketing/calendar/event-dialog";
import { type NoteDialogTarget, NoteDialog } from "@/components/marketing/calendar/note-dialog";
import {
  type RescheduleTarget,
  RescheduleDialog,
} from "@/components/marketing/calendar/reschedule-dialog";
import { UNDATED_PREFIX, UndatedPanel } from "@/components/marketing/calendar/undated-panel";
import { useBrand } from "@/hooks/marketing/use-brand";
import { useCalendarState } from "@/hooks/shared/use-calendar-state";
import { listChannels } from "@/lib/marketing/channels/channels.functions";
import { listAssigneeOptions } from "@/lib/marketing/content/content.functions";
import { listCalendarEntries } from "@/lib/marketing/calendar/calendar.functions";
import { archiveCalendarNote } from "@/lib/marketing/calendar/notes.functions";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { GuardContext } from "@/hooks/shared/use-unsaved-changes";
import { calendarAlerts } from "@/lib/shared/calendar/alerts";
import { entryKey, isMovable } from "@/lib/shared/calendar/entries";
import { rangeTitle } from "@/lib/shared/calendar/range";
import { moveToDay } from "@/lib/shared/calendar/reschedule";
import { calendarSearchSchema } from "@/lib/shared/calendar/search";
import type { CalendarEntry, UndatedEntry } from "@/lib/shared/calendar/types";
import {
  CalendarEntryKind,
  CalendarNoteKind,
  CalendarNoteRepeat,
  CalendarView,
  EditorialStatus,
  PublicationStatus,
} from "@/lib/shared/enums";
import { instantToLocalInput, todayInZone } from "@/lib/shared/format";
import {
  editorialStatusLabels,
  platformLabels,
  publicationStatusLabels,
} from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { StoredKey, readStored, writeStored } from "@/lib/shared/stored-keys";
import { cn } from "@/lib/shared/utils";

const ALL = "all";
const DEFAULT_PLAN_TIME = "T09:00";

const editorialOptions = [
  { value: ALL, label: "Todos os estados" },
  ...Object.values(EditorialStatus).map((value) => ({
    value,
    label: editorialStatusLabels[value],
  })),
];

const publicationOptions = [
  { value: ALL, label: "Todas as publicações" },
  ...Object.values(PublicationStatus).map((value) => ({
    value,
    label: publicationStatusLabels[value],
  })),
];

const deadlineOptions = [
  { value: ALL, label: "Todos os itens" },
  { value: "deadlines", label: "Somente prazos" },
];

const isDeadline = (entry: CalendarEntry): boolean =>
  entry.kind === CalendarEntryKind.ApprovalDeadline ||
  entry.kind === CalendarEntryKind.ProductionDeadline;

const publicationTarget = (
  entry: CalendarEntry,
  initialLocal: string | undefined,
): RescheduleTarget | null =>
  entry.channelRowId === null
    ? null
    : {
        kind: "publication",
        channelRowId: entry.channelRowId,
        title: entry.title,
        brandTimezone: entry.brandTimezone,
        editorialStatus: entry.editorialStatus ?? EditorialStatus.Draft,
        currentAt: entry.at,
        version: entry.version ?? 1,
        ...(initialLocal === undefined ? {} : { initialLocal }),
      };

const undatedTarget = (entry: UndatedEntry, day: string | null): RescheduleTarget => ({
  kind: "publication",
  channelRowId: entry.channelRowId,
  title: entry.title,
  brandTimezone: entry.brandTimezone,
  editorialStatus: entry.editorialStatus,
  currentAt: null,
  version: entry.version,
  ...(day === null ? {} : { initialLocal: `${day}${DEFAULT_PLAN_TIME}` }),
});

const noteKindOf = (entry: CalendarEntry): CalendarNoteKind => {
  if (entry.kind === CalendarEntryKind.Idea) return CalendarNoteKind.Idea;
  return entry.kind === CalendarEntryKind.Event ? CalendarNoteKind.Event : CalendarNoteKind.Date;
};

export function CalendarPage({ fixedBrandId }: { fixedBrandId?: string }) {
  const auth = useAuth();
  const raw = calendarSearchSchema.parse(useSearch({ strict: false }));
  const brandId = fixedBrandId ?? raw.brand;
  const { run, busy } = useServerAction();
  const canManage = can(auth, Action.Calendar.Manage) && can(auth, Action.Content.Update);
  const canNote = can(auth, Action.Calendar.Manage);
  const canCreate = can(auth, Action.Content.Create);
  const unsavedGuard = useContext(GuardContext);

  const brand = useBrand(brandId ?? "", brandId !== undefined);
  const [browserZone, setBrowserZone] = useState("UTC");
  const zone = brandId === undefined ? browserZone : (brand.data?.timezone ?? null);
  const state = useCalendarState(zone ?? "UTC");

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [target, setTarget] = useState<RescheduleTarget | null>(null);
  const [undatedOpen, setUndatedOpen] = useState(true);
  const [noteTarget, setNoteTarget] = useState<NoteDialogTarget | null>(null);
  const [archiving, setArchiving] = useState<CalendarEntry | null>(null);
  const [scheduledDay, setScheduledDay] = useState<string | null>(null);

  useEffect(() => {
    setUndatedOpen(readStored(StoredKey.CalendarUndatedOpen, z.boolean(), true));
  }, []);

  useEffect(() => {
    if (brandId === undefined) setBrowserZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [brandId]);

  function toggleUndated() {
    const next = !undatedOpen;
    setUndatedOpen(next);
    writeStored(StoredKey.CalendarUndatedOpen, next);
  }

  async function requestCloseScheduler() {
    if (unsavedGuard && !(await unsavedGuard.confirmDiscard())) return;
    setScheduledDay(null);
  }

  const brands = useBrandOptions(fixedBrandId === undefined);
  const channels = useQuery({
    queryKey: QueryKey.Channels.list(brandId ?? "", { status: "active" }),
    queryFn: async () =>
      unwrapResult(await listChannels({ data: { brandId: brandId ?? "" } })).channels,
    enabled: brandId !== undefined && can(auth, Action.Channels.View),
  });
  const owners = useQuery({
    queryKey: QueryKey.Content.assignees(brandId ?? ""),
    queryFn: async () =>
      unwrapResult(await listAssigneeOptions({ data: { brandId: brandId ?? "" } })).people,
    enabled: brandId !== undefined,
  });

  const request = {
    from: state.from.toISOString(),
    to: state.to.toISOString(),
    ...(brandId ? { brandId } : {}),
    ...(state.search.channel ? { channelId: state.search.channel } : {}),
    ...(state.search.owner ? { ownerId: state.search.owner } : {}),
    ...(state.search.editorial ? { editorial: state.search.editorial } : {}),
    ...(state.search.publication ? { publication: state.search.publication } : {}),
    notes: [CalendarNoteKind.Idea, CalendarNoteKind.Date, CalendarNoteKind.Event],
  };
  const query = useQuery({
    queryKey: QueryKey.Calendar.entries(request),
    queryFn: async () => unwrapResult(await listCalendarEntries({ data: request })),
    placeholderData: keepPreviousData,
    enabled: zone !== null,
  });

  const activeZone = zone ?? "UTC";
  const entries = useMemo(
    () =>
      (query.data?.entries ?? []).filter((entry) => !state.search.deadlines || isDeadline(entry)),
    [query.data, state.search.deadlines],
  );
  const alerts = useMemo(
    () => calendarAlerts(entries, activeZone, new Date()),
    [entries, activeZone],
  );
  const movableEntry = (entry: CalendarEntry) =>
    canManage && isMovable(entry) && !entry.channelArchived;
  const items = entries.flatMap((entry) => {
    const key = entryKey(entry);
    const item = toGridItem(entry, activeZone, alerts.get(key) ?? [], movableEntry(entry), key);
    return item !== null && item.day >= state.range.start && item.day < state.range.end
      ? [item]
      : [];
  });

  const selected = entries.find((entry) => entryKey(entry) === selectedKey) ?? null;
  const showGrid = state.view !== CalendarView.List;

  function dropUndated(channelRowId: string, day: string) {
    const undated = query.data?.undated.find((entry) => entry.channelRowId === channelRowId);
    if (undated) setTarget(undatedTarget(undated, day));
  }

  function dropDeadline(entry: CalendarEntry, day: string) {
    if (entry.date === day || entry.itemId === null || entry.itemVersion === null) return;
    setTarget({
      kind: "deadline",
      itemId: entry.itemId,
      title: entry.title,
      currentDate: entry.date ?? day,
      version: entry.itemVersion,
      initialDate: day,
    });
  }

  function dropPublication(entry: CalendarEntry, at: string, day: string) {
    const moved = moveToDay(at, day, activeZone);
    const initialLocal = moved.ok
      ? instantToLocalInput(moved.instant, entry.brandTimezone)
      : `${day}${instantToLocalInput(at, entry.brandTimezone).slice(10)}`;
    const next = publicationTarget(entry, initialLocal);
    if (next) setTarget(next);
  }

  function startDrop(key: string, day: string) {
    if (key.startsWith(UNDATED_PREFIX)) return dropUndated(key.slice(UNDATED_PREFIX.length), day);
    const entry = entries.find((candidate) => entryKey(candidate) === key);
    if (!entry || !movableEntry(entry)) return;
    if (entry.kind === CalendarEntryKind.ProductionDeadline) return dropDeadline(entry, day);
    if (entry.at !== null) dropPublication(entry, entry.at, day);
  }

  function changeDate(entry: CalendarEntry) {
    setSelectedKey(null);
    if (
      entry.kind === CalendarEntryKind.ProductionDeadline &&
      entry.itemId !== null &&
      entry.itemVersion !== null
    ) {
      setTarget({
        kind: "deadline",
        itemId: entry.itemId,
        title: entry.title,
        currentDate: entry.date ?? todayInZone(activeZone),
        version: entry.itemVersion,
      });
      return;
    }
    const next = publicationTarget(entry, undefined);
    if (next) setTarget(next);
  }

  const title = rangeTitle(state.view, state.range, state.anchor);

  function editNote(entry: CalendarEntry) {
    if (entry.noteId === null || entry.noteVersion === null) return;
    const kind = noteKindOf(entry);
    setSelectedKey(null);
    setNoteTarget({
      kind,
      day: entry.date ?? todayInZone(activeZone),
      brandId: entry.brandId,
      note: {
        id: entry.noteId,
        brandId: entry.brandId,
        kind,
        title: entry.title,
        description: entry.description,
        noteDate: entry.date ?? todayInZone(activeZone),
        endDate: entry.endDate,
        repeat: entry.repeat ?? CalendarNoteRepeat.None,
        convertedItemId: entry.convertedItemId,
        eventType: entry.eventType,
        allDay: entry.allDay,
        startsAt: entry.startsAt,
        endsAt: entry.endsAt,
        timezone: entry.timezone,
        location: entry.location,
        clientVisible: entry.clientVisible,
        internalNotes: entry.internalNotes,
        archived: false,
        version: entry.noteVersion,
      },
    });
  }

  const addMenu = (day: string) => (
    <DayAddMenu
      day={day}
      canSchedule={canCreate}
      canNote={canNote}
      onSchedule={setScheduledDay}
      onNote={(kind, chosen) => setNoteTarget({ kind, day: chosen, brandId, note: undefined })}
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendário"
        description="O que está planejado, quando e em qual estado."
        breadcrumbs={fixedBrandId ? undefined : [{ label: "Calendário" }]}
      />
      <CalendarToolbar
        title={title}
        view={state.view}
        showViews={!state.mobile}
        onViewChange={(view) => void state.setView(view)}
        onPrevious={() => void state.shift(-1)}
        onNext={() => void state.shift(1)}
        onToday={() => void state.goToday()}
        actions={
          <div className="flex items-center gap-2">
            <ListFilters
              groups={[
                ...(fixedBrandId === undefined
                  ? [
                      {
                        id: "brand",
                        label: "Marca",
                        value: brandId ?? ALL,
                        defaultValue: ALL,
                        emptyText:
                          brands.data?.length === 0 ? "Nenhuma marca cadastrada" : undefined,
                        options: brandSelectOptions(brands.data, "Todas as marcas", ALL),
                        onChange: (value: string) => {
                          if (value !== ALL) writeStored(StoredKey.CalendarBrand, value);
                          void state.setFilter("brand", value === ALL ? "" : value);
                          void state.setFilter("channel", "");
                          void state.setFilter("owner", "");
                        },
                      },
                    ]
                  : []),
                {
                  id: "channel",
                  label: "Canal",
                  value: state.search.channel ?? ALL,
                  defaultValue: ALL,
                  emptyText:
                    channels.data?.length === 0 ? "Nenhum canal ativo nesta marca" : undefined,
                  options: [
                    {
                      value: ALL,
                      label: brandId === undefined ? "Escolha uma marca" : "Todos os canais",
                    },
                    ...(channels.data ?? []).map((channel) => ({
                      value: channel.id,
                      label: `${platformLabels[channel.platform]} · ${channel.profileName}`,
                    })),
                  ],
                  onChange: (value) => void state.setFilter("channel", value === ALL ? "" : value),
                },
                {
                  id: "owner",
                  label: "Responsável",
                  value: state.search.owner ?? ALL,
                  defaultValue: ALL,
                  emptyText: owners.data?.length === 0 ? "Nenhuma pessoa disponível" : undefined,
                  options: [
                    { value: ALL, label: brandId === undefined ? "Escolha uma marca" : "Todos" },
                    ...(owners.data ?? []).map((person) => ({
                      value: person.id,
                      label: person.name,
                    })),
                  ],
                  onChange: (value) => void state.setFilter("owner", value === ALL ? "" : value),
                },
                {
                  id: "editorial",
                  label: "Estado",
                  value: state.search.editorial ?? ALL,
                  defaultValue: ALL,
                  options: editorialOptions,
                  onChange: (value) =>
                    void state.setFilter("editorial", value === ALL ? "" : value),
                },
                {
                  id: "publication",
                  label: "Publicação",
                  value: state.search.publication ?? ALL,
                  defaultValue: ALL,
                  options: publicationOptions,
                  onChange: (value) =>
                    void state.setFilter("publication", value === ALL ? "" : value),
                },
                {
                  id: "deadlines",
                  label: "Itens exibidos",
                  value: state.search.deadlines ? "deadlines" : ALL,
                  defaultValue: ALL,
                  options: deadlineOptions,
                  onChange: (value) => void state.setDeadlinesOnly(value === "deadlines"),
                },
              ]}
            />
            <IconButton
              variant="outline"
              icon={CalendarClock}
              label={undatedOpen ? "Ocultar conteúdos sem data" : "Mostrar conteúdos sem data"}
              onClick={toggleUndated}
            />
          </div>
        }
      >
        <p
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          aria-label={`Fuso horário: ${activeZone}`}
        >
          <Globe aria-hidden="true" className="size-4" />
          {activeZone.replaceAll("_", " ")}
        </p>
      </CalendarToolbar>
      {query.data?.truncated ? (
        <Alert>
          <AlertDescription>
            Há mais itens do que o calendário mostra. Filtre por marca ou canal.
          </AlertDescription>
        </Alert>
      ) : null}
      {zone === null || query.isPending ? (
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
      ) : (
        <div className={cn("relative", undatedOpen && "lg:pr-[17rem]")}>
          <div className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            {showGrid ? (
              <CalendarGrid
                label={`Calendário, ${title}`}
                days={state.range.days}
                items={items}
                today={todayInZone(activeZone)}
                month={state.view === CalendarView.Month ? state.anchor.slice(0, 7) : null}
                compact={state.view === CalendarView.Month}
                onSelect={setSelectedKey}
                onOpenDay={(day) => void state.openDay(day)}
                onDropKey={canManage ? startDrop : undefined}
                renderDayAction={addMenu}
              />
            ) : (
              <CalendarList items={items} onSelect={setSelectedKey} />
            )}
          </div>
          {undatedOpen ? (
            <div className="absolute right-0 top-0 z-10 max-h-[70vh] w-64 max-w-[calc(100%_-_1rem)] overflow-y-auto rounded-xl shadow-md">
              <UndatedPanel
                entries={query.data.undated}
                canPlan={canManage}
                onPlan={(entry) => setTarget(undatedTarget(entry, null))}
              />
            </div>
          ) : null}
        </div>
      )}
      <CalendarLegend showKinds />
      {selected ? (
        <EntryDetails
          entry={selected}
          zone={activeZone}
          alerts={alerts.get(entryKey(selected)) ?? []}
          changeBlockedReason={
            selected.channelArchived
              ? "O canal está arquivado. Reative o canal antes de mudar a data."
              : null
          }
          onChangeDate={canManage && isMovable(selected) ? () => changeDate(selected) : null}
          onEditNote={canNote ? () => editNote(selected) : null}
          onArchiveNote={
            canNote
              ? () => {
                  setSelectedKey(null);
                  setArchiving(selected);
                }
              : null
          }
          canConvert={canCreate && canNote}
          onClose={() => setSelectedKey(null)}
        />
      ) : null}
      {noteTarget && noteTarget.kind === CalendarNoteKind.Event ? (
        <EventDialog
          key={noteTarget.note?.id ?? `new-event-${noteTarget.day}`}
          target={noteTarget}
          onOpenChange={(open) => !open && setNoteTarget(null)}
        />
      ) : null}
      {noteTarget && noteTarget.kind !== CalendarNoteKind.Event ? (
        <NoteDialog
          key={noteTarget.note?.id ?? "new-" + noteTarget.kind + "-" + noteTarget.day}
          target={noteTarget}
          onOpenChange={(open) => !open && setNoteTarget(null)}
        />
      ) : null}
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={"Arquivar “" + (archiving?.title ?? "") + "”?"}
        description="Ela sai do calendário. Se virou conteúdo, o conteúdo continua."
        confirmLabel="Arquivar"
        destructive
        busy={busy}
        onConfirm={async () => {
          const noteId = archiving?.noteId;
          if (noteId === null || noteId === undefined) return false;
          const result = await run(() => archiveCalendarNote({ data: { id: noteId } }), {
            invalidate: [QueryKey.Calendar.all()],
            success: "Arquivada.",
          });
          return result.ok;
        }}
      />
      {target ? (
        <RescheduleDialog
          key={target.kind === "publication" ? target.channelRowId : target.itemId}
          target={target}
          onOpenChange={(open) => !open && setTarget(null)}
        />
      ) : null}
      <Dialog
        open={scheduledDay !== null}
        onOpenChange={(open) => !open && void requestCloseScheduler()}
      >
        <DialogContent className="!fixed !inset-0 !left-0 !top-0 !h-[100dvh] !max-h-[100dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 !overflow-y-auto !rounded-none !p-4 sm:!p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>Agendar conteúdo</DialogTitle>
            <DialogDescription>Crie o conteúdo sem sair do calendário.</DialogDescription>
          </DialogHeader>
          {scheduledDay !== null ? (
            <ContentEditorPage
              brandId={brandId}
              day={scheduledDay}
              onSaved={() => setScheduledDay(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
