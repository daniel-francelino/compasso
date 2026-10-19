import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  type LucideIcon,
  List,
  CalendarRange,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import { CalendarView } from "@/lib/shared/enums";
import { calendarViewLabels } from "@/lib/shared/labels";

const viewIcons: Record<CalendarView, LucideIcon> = {
  [CalendarView.Month]: CalendarDays,
  [CalendarView.Week]: CalendarRange,
  [CalendarView.List]: List,
};

export function CalendarToolbar({
  title,
  view,
  showViews,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  children,
  actions,
}: {
  title: string;
  view: CalendarView;
  showViews: boolean;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onToday}>
          <CalendarDays aria-hidden="true" />
          Hoje
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Período anterior"
          onClick={onPrevious}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Próximo período"
          onClick={onNext}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <h2 className="text-lg font-semibold first-letter:uppercase" aria-live="polite">
          {title}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        {showViews ? (
          <Tabs value={view} onValueChange={(value) => onViewChange(value as CalendarView)}>
            <TabsList>
              {Object.values(CalendarView).map((value) => {
                const Icon = viewIcons[value];
                return (
                  <TabsTrigger key={value} value={value}>
                    <Icon aria-hidden="true" />
                    {calendarViewLabels[value]}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
