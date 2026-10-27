import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { useIsMobile } from "@/hooks/shared/use-mobile";
import { rangeInstants, shiftAnchor, visibleRange } from "@/lib/shared/calendar/range";
import { type CalendarSearch, calendarSearchSchema } from "@/lib/shared/calendar/search";
import { CalendarView } from "@/lib/shared/enums";
import { StoredKey, readStored, writeStored } from "@/lib/shared/stored-keys";
import { todayInZone } from "@/lib/shared/dates";

const storedViewSchema = z.nativeEnum(CalendarView);

export const useCalendarState = (zone: string) => {
  const raw = useSearch({ strict: false });
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const search: CalendarSearch = calendarSearchSchema.parse(raw);

  const chosenView =
    search.view ?? readStored(StoredKey.CalendarView, storedViewSchema, CalendarView.Week);
  const view = mobile ? CalendarView.List : chosenView;
  const anchor = search.date ?? todayInZone(zone);
  const range = visibleRange(view, anchor);
  const { from, to } = rangeInstants(range, zone);

  useEffect(() => {
    if (search.view !== undefined) writeStored(StoredKey.CalendarView, search.view);
  }, [search.view]);

  const update = (patch: Partial<CalendarSearch>) =>
    navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({ ...previous, ...patch })) as never,
      replace: true,
    });

  return {
    view,
    anchor,
    range,
    from,
    to,
    search,
    mobile,
    setView: (next: CalendarView) => {
      return update({ view: next });
    },
    goToday: () => update({ date: undefined }),
    goTo: (date: string) => update({ date }),
    openDay: (date: string) => update({ date, view: CalendarView.Week }),
    shift: (direction: 1 | -1) => update({ date: shiftAnchor(view, anchor, direction) }),
    setFilter: (key: "brand" | "channel" | "owner" | "editorial" | "publication", value: string) =>
      update({ [key]: value === "" ? undefined : value }),
    setDeadlinesOnly: (value: boolean) => update({ deadlines: value ? true : undefined }),
    setZone: (value: string) => update({ zone: value }),
  };
};
