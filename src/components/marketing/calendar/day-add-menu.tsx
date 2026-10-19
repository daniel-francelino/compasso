import { CalendarDays, CalendarPlus, Lightbulb, Plus } from "lucide-react";
import { Button } from "@/components/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
import { CalendarNoteKind } from "@/lib/shared/enums";

export function DayAddMenu({
  day,
  canSchedule,
  canNote,
  onSchedule,
  onNote,
}: {
  day: string;
  canSchedule: boolean;
  canNote: boolean;
  onSchedule: (day: string) => void;
  onNote: (kind: CalendarNoteKind, day: string) => void;
}) {
  if (!canSchedule && !canNote) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-xs opacity-0 transition-opacity focus-visible:opacity-100 group-hover/day:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Adicionar no dia ${day.slice(8)}`}
        >
          <Plus aria-hidden="true" />
          Adicionar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {canSchedule ? (
          <DropdownMenuItem onSelect={() => onSchedule(day)}>
            <CalendarPlus aria-hidden="true" />
            Agendar conteúdo
          </DropdownMenuItem>
        ) : null}
        {canNote ? (
          <>
            <DropdownMenuItem onSelect={() => onNote(CalendarNoteKind.Date, day)}>
              <CalendarDays aria-hidden="true" />
              Adicionar data
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onNote(CalendarNoteKind.Idea, day)}>
              <Lightbulb aria-hidden="true" />
              Adicionar ideia
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
