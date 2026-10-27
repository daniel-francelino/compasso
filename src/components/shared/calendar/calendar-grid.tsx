import { Fragment, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { EntryChip } from "@/components/shared/calendar/entry-chip";
import { Button } from "@/components/shared/ui/button";
import type { GridItem } from "@/lib/shared/calendar/grid-item";
import { formatWeekdayShort } from "@/lib/shared/format";
import { addDaysToDate } from "@/lib/shared/dates";
import { cn } from "@/lib/shared/utils";

const MONTH_LIMIT = 3;

const stepOf: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export function CalendarGrid({
  label,
  days,
  items,
  today,
  month,
  compact,
  onSelect,
  onOpenDay,
  onDropKey,
  renderDayAction,
  renderItem,
}: {
  label: string;
  days: string[];
  items: GridItem[];
  today: string;
  month: string | null;
  compact: boolean;
  onSelect: (key: string) => void;
  onOpenDay: (day: string) => void;
  onDropKey?: ((key: string, day: string) => void) | undefined;
  renderDayAction?: ((day: string) => ReactNode) | undefined;
  renderItem?: ((item: GridItem, trigger: ReactNode) => ReactNode) | undefined;
}) {
  const [focused, setFocused] = useState(days.includes(today) ? today : (days[0] ?? today));
  const [over, setOver] = useState<string | null>(null);
  const first = days[0] ?? "";
  const last = days[days.length - 1] ?? "";

  function move(event: KeyboardEvent<HTMLDivElement>, day: string) {
    const step = stepOf[event.key];
    const target =
      step !== undefined
        ? addDaysToDate(day, step)
        : event.key === "Home"
          ? addDaysToDate(day, -(days.indexOf(day) % 7))
          : event.key === "End"
            ? addDaysToDate(day, 6 - (days.indexOf(day) % 7))
            : null;
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      onOpenDay(day);
      return;
    }
    if (target === null || target < first || target > last) return;
    event.preventDefault();
    setFocused(target);
    event.currentTarget.parentElement
      ?.querySelector<HTMLElement>(`[data-day="${target}"]`)
      ?.focus();
  }

  return (
    <div role="grid" aria-label={label} className="overflow-hidden rounded-xl border border-border">
      <div role="row" className="grid grid-cols-7 border-b border-border bg-muted">
        {days.slice(0, 7).map((day) => (
          <div
            key={day}
            role="columnheader"
            className="px-2 py-1.5 text-center text-xs font-medium capitalize text-muted-foreground"
          >
            {formatWeekdayShort(day)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 bg-card">
        {days.map((day) => {
          const dayItems = items.filter((item) => item.day === day);
          const shown = compact ? dayItems.slice(0, MONTH_LIMIT) : dayItems;
          const hidden = dayItems.length - shown.length;
          const outside = month !== null && !day.startsWith(month);
          return (
            <div
              key={day}
              role="gridcell"
              data-day={day}
              tabIndex={focused === day ? 0 : -1}
              aria-label={`${day.slice(8)}, ${dayItems.length} ${dayItems.length === 1 ? "item" : "itens"}`}
              onFocus={() => setFocused(day)}
              onKeyDown={(event) => move(event, day)}
              onDragOver={onDropKey ? (event) => (event.preventDefault(), setOver(day)) : undefined}
              onDragLeave={() => setOver((current) => (current === day ? null : current))}
              onDrop={
                onDropKey
                  ? (event) => {
                      event.preventDefault();
                      setOver(null);
                      const key = event.dataTransfer.getData("text/plain");
                      if (key !== "") onDropKey(key, day);
                    }
                  : undefined
              }
              className={cn(
                "group/day flex flex-col gap-1 border-b border-r border-border p-1.5 outline-offset-[-2px]",
                "focus-visible:outline-2 focus-visible:outline-ring",
                compact ? "min-h-28" : "min-h-56",
                outside && "bg-muted/40 text-muted-foreground",
                over === day && "bg-accent",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span>{renderDayAction ? renderDayAction(day) : null}</span>
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs",
                    day === today && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
              </div>
              {shown.map((item) => {
                const trigger = <EntryChip item={item} onSelect={onSelect} />;
                return (
                  <Fragment key={item.key}>
                    {renderItem ? renderItem(item, trigger) : trigger}
                  </Fragment>
                );
              })}
              {hidden > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 justify-start px-1.5 text-xs"
                  onClick={() => onOpenDay(day)}
                >
                  +{hidden} {hidden === 1 ? "item" : "itens"}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
