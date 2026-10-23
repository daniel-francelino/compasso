import { format } from "date-fns";
import { pt } from "date-fns/locale/pt";
import { CalendarDays, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { Button } from "@/components/shared/ui/button";
import { Calendar } from "@/components/shared/ui/calendar";
import { Label } from "@/components/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import { parseDateValue, toDateValue } from "@/lib/shared/date-value";
import { cn } from "@/lib/shared/utils";

export function DatePickerField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  tip,
  yearRange,
  minDate,
  disabled = false,
  clearable = false,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  tip?: { label: string; content: ReactNode } | undefined;
  yearRange?: { from: number; to: number } | undefined;
  minDate?: string | undefined;
  disabled?: boolean;
  clearable?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const earliest = minDate === undefined ? undefined : parseDateValue(minDate);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-1 text-destructive">
              *
            </span>
          ) : null}
        </Label>
        {tip ? <InfoTip label={tip.label}>{tip.content}</InfoTip> : null}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-md border-input bg-background px-3 text-left text-sm font-normal shadow-sm hover:bg-background pointer-coarse:h-11",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            <span>
              {selected
                ? format(selected, "d 'de' MMMM 'de' yyyy", { locale: pt })
                : "Selecionar data"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-xl p-2">
          <Calendar
            mode="single"
            locale={pt}
            selected={selected}
            {...(earliest ? { disabled: { before: earliest } } : {})}
            {...(yearRange
              ? {
                  captionLayout: "dropdown" as const,
                  startMonth: new Date(yearRange.from, 0),
                  endMonth: new Date(yearRange.to, 11),
                  defaultMonth: selected ?? new Date(Math.min(yearRange.to, 1990), 0),
                }
              : {})}
            onSelect={(date) => {
              if (date) onChange(toDateValue(date));
              else if (clearable) onChange("");
              if (date || clearable) setOpen(false);
            }}
            initialFocus
          />
          {clearable && selected ? (
            <div className="border-t border-border px-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <X aria-hidden="true" />
                Limpar data
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      {error || hint ? (
        <p className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
