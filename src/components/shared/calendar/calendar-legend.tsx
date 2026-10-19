import {
  CalendarClock,
  CalendarDays,
  CircleCheck,
  Clock3,
  Hammer,
  Hourglass,
  Lightbulb,
  Send,
} from "lucide-react";
import { EditorialStatusBadge } from "@/components/shared/content/status-badges";
import { CalendarEntryKind, EditorialStatus } from "@/lib/shared/enums";
import { calendarEntryKindLabels } from "@/lib/shared/labels";

const marks = [
  { label: "Publicados", icon: CircleCheck, className: "text-success" },
  { label: "Agendados", icon: Clock3, className: "text-warning" },
];

const kinds = [
  { kind: CalendarEntryKind.Publication, icon: CalendarClock },
  { kind: CalendarEntryKind.Published, icon: Send },
  { kind: CalendarEntryKind.ApprovalDeadline, icon: Hourglass },
  { kind: CalendarEntryKind.ProductionDeadline, icon: Hammer },
  { kind: CalendarEntryKind.Idea, icon: Lightbulb },
  { kind: CalendarEntryKind.Date, icon: CalendarDays },
];

const statuses = [
  EditorialStatus.Draft,
  EditorialStatus.InProduction,
  EditorialStatus.InternalReview,
  EditorialStatus.AwaitingApproval,
  EditorialStatus.ChangesRequested,
  EditorialStatus.Approved,
];

export function CalendarLegend({ showKinds }: { showKinds: boolean }) {
  return (
    <section aria-label="Legenda" className="space-y-2 text-xs text-muted-foreground">
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Marcas de estado">
        {marks.map(({ label, icon: Icon, className }) => (
          <li key={label} className="flex items-center gap-1.5">
            <Icon className={`size-3.5 ${className}`} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
      {showKinds ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {kinds.map(({ kind, icon: Icon }) => (
            <li key={kind} className="flex items-center gap-1.5">
              <Icon className="size-3.5" aria-hidden="true" />
              {calendarEntryKindLabels[kind]}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <li key={status}>
            <EditorialStatusBadge status={status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
