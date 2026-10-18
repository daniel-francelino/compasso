import { CalendarDays, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { type GridItem, itemLabel } from "@/lib/shared/calendar/grid-item";
import { formatDateOnly, formatWeekdayShort } from "@/lib/shared/format";

export function CalendarList({
  items,
  onSelect,
}: {
  items: GridItem[];
  onSelect: (key: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nada planejado neste período"
        description="Mude o período ou limpe os filtros. Conteúdos sem data ficam na lista “Sem data”."
      />
    );
  }

  const days = [...new Set(items.map((item) => item.day))].sort();
  return (
    <ol className="space-y-4">
      {days.map((day) => (
        <li key={day}>
          <h3 className="mb-2 text-sm font-semibold capitalize">
            {formatWeekdayShort(day)}, {formatDateOnly(day)}
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {items
              .filter((item) => item.day === day)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      aria-label={itemLabel(item)}
                      onClick={() => onSelect(item.key)}
                      className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">
                        {item.time === "" ? "Prazo" : item.time}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      </span>
                      {item.alerts.length > 0 ? (
                        <TriangleAlert
                          className="size-4 shrink-0 text-warning"
                          aria-hidden="true"
                        />
                      ) : null}
                      <StatusBadge tone={item.tone} icon={Icon} className="shrink-0">
                        {item.statusLabel}
                      </StatusBadge>
                    </button>
                  </li>
                );
              })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
