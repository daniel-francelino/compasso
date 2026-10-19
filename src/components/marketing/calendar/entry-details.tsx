import { Link } from "@tanstack/react-router";
import {
  Archive,
  CalendarClock,
  ExternalLink,
  Pencil,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { WhyDisabled } from "@/components/shared/admin/why-disabled";
import { entrySubtitle } from "@/components/shared/calendar/entry-items";
import { EditorialStatusBadge } from "@/components/shared/content/status-badges";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import type { CalendarEntry } from "@/lib/shared/calendar/types";
import { type CalendarAlert, CalendarEntryKind } from "@/lib/shared/enums";
import { formatDateOnly, formatInZone } from "@/lib/shared/format";
import {
  calendarAlertLabels,
  calendarEntryKindLabels,
  calendarNoteRepeatLabels,
} from "@/lib/shared/labels";

export function EntryDetails({
  entry,
  zone,
  alerts,
  changeBlockedReason,
  onChangeDate,
  onEditNote,
  onArchiveNote,
  canConvert,
  onClose,
}: {
  entry: CalendarEntry;
  zone: string;
  alerts: CalendarAlert[];
  changeBlockedReason: string | null;
  onChangeDate: (() => void) | null;
  onEditNote: (() => void) | null;
  onArchiveNote: (() => void) | null;
  canConvert: boolean;
  onClose: () => void;
}) {
  const when =
    entry.at !== null
      ? formatInZone(entry.at, entry.plannedTimezone ?? zone)
      : entry.date !== null
        ? formatDateOnly(entry.date)
        : "—";
  const isNote = entry.kind === CalendarEntryKind.Idea || entry.kind === CalendarEntryKind.Date;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry.title}</DialogTitle>
          <DialogDescription>
            {calendarEntryKindLabels[entry.kind]} · {entrySubtitle(entry, zone)}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-muted-foreground">Quando</dt>
            <dd className="font-medium">{when}</dd>
          </div>
          {isNote && entry.repeat !== null ? (
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted-foreground">Repete</dt>
              <dd>{calendarNoteRepeatLabels[entry.repeat]}</dd>
            </div>
          ) : null}
          {isNote && entry.description ? (
            <div>
              <dt className="sr-only">Descrição</dt>
              <dd className="whitespace-pre-wrap text-sm">{entry.description}</dd>
            </div>
          ) : null}
          {entry.editorialStatus !== null ? (
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                <EditorialStatusBadge status={entry.editorialStatus} />
              </dd>
            </div>
          ) : null}
          {entry.assigneeName !== null ? (
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-muted-foreground">Responsável</dt>
              <dd>{entry.assigneeName}</dd>
            </div>
          ) : null}
        </dl>
        {alerts.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {alerts.map((alert) => (
              <li key={alert} className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                {calendarAlertLabels[alert]}
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter className="gap-2">
          {entry.kind === CalendarEntryKind.ApprovalDeadline && entry.requestId !== null ? (
            <Button asChild variant="outline">
              <Link
                to="/admin/marketing/approvals/$requestId"
                params={{ requestId: entry.requestId }}
              >
                <ExternalLink aria-hidden="true" />
                Abrir aprovação
              </Link>
            </Button>
          ) : null}
          {isNote ? (
            <>
              {onArchiveNote !== null && entry.convertedItemId === null ? (
                <Button type="button" variant="outline" onClick={onArchiveNote}>
                  <Archive aria-hidden="true" />
                  Arquivar
                </Button>
              ) : null}
              {onEditNote !== null && entry.convertedItemId === null ? (
                <Button type="button" variant="outline" onClick={onEditNote}>
                  <Pencil aria-hidden="true" />
                  Editar
                </Button>
              ) : null}
              {entry.convertedItemId !== null ? (
                <Button asChild variant="outline">
                  <Link
                    to="/admin/marketing/content/$itemId"
                    params={{ itemId: entry.convertedItemId }}
                  >
                    <ExternalLink aria-hidden="true" />
                    Abrir conteúdo
                  </Link>
                </Button>
              ) : null}
              {canConvert && entry.convertedItemId === null && entry.noteId !== null ? (
                <Button asChild>
                  <Link to="/admin/marketing/content/new" search={{ note: entry.noteId }}>
                    <RefreshCw aria-hidden="true" />
                    Converter em conteúdo
                  </Link>
                </Button>
              ) : null}
            </>
          ) : entry.itemId !== null ? (
            <Button asChild variant="outline">
              <Link to="/admin/marketing/content/$itemId" params={{ itemId: entry.itemId }}>
                <ExternalLink aria-hidden="true" />
                Abrir conteúdo
              </Link>
            </Button>
          ) : null}
          {onChangeDate !== null ? (
            <WhyDisabled reason={changeBlockedReason}>
              <Button type="button" disabled={changeBlockedReason !== null} onClick={onChangeDate}>
                <CalendarClock aria-hidden="true" />
                Alterar data…
              </Button>
            </WhyDisabled>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
