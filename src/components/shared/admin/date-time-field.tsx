import { format } from "date-fns";
import { pt } from "date-fns/locale/pt";
import { CalendarDays, Clock3, X } from "lucide-react";
import { useState } from "react";
import { hintTip } from "@/components/shared/admin/field-tip";
import { FieldLabel, FieldMessage } from "@/components/shared/admin/form-fields";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { Button } from "@/components/shared/ui/button";
import { Calendar } from "@/components/shared/ui/calendar";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/shared/ui/radio-group";
import { LocalTimeProblem, resolveLocalTime } from "@/lib/shared/calendar/reschedule";
import { formatInZone, instantToLocalInput } from "@/lib/shared/format";
import { parseDateValue, toDateValue } from "@/lib/shared/date-value";

const NONEXISTENT_TIME = "Este horário não existe nesse dia (mudança de horário de verão).";
const AMBIGUOUS_TIME = "Este horário acontece duas vezes nesse dia. Escolha qual.";
const INVALID_TIME = "Informe um horário válido no formato HH:mm.";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type Occurrences = [Date, Date] | null;

const occurrencesOf = (text: string, timeZone: string): Occurrences => {
  if (text === "") return null;
  const resolved = resolveLocalTime(text, timeZone);
  return !resolved.ok && resolved.problem === LocalTimeProblem.Ambiguous ? resolved.options : null;
};

const isNonexistent = (text: string, timeZone: string): boolean => {
  if (text === "") return false;
  const resolved = resolveLocalTime(text, timeZone);
  return !resolved.ok && resolved.problem === LocalTimeProblem.Nonexistent;
};

const normalizeTime = (value: string): string =>
  value
    .replace(/\D/g, "")
    .slice(0, 4)
    .replace(/^(\d{2})(\d)/, "$1:$2");

export function DateTimeField({
  id,
  label,
  value,
  timeZone,
  onValueChange,
  initialLocal,
  error,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  value: string | null;
  timeZone: string;
  onValueChange: (instant: string | null) => void;
  initialLocal?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  disabled?: boolean;
}) {
  const initialText = value === null ? (initialLocal ?? "") : instantToLocalInput(value, timeZone);
  const [text, setText] = useState(initialText);
  const [occurrences, setOccurrences] = useState<Occurrences>(() =>
    value === null ? occurrencesOf(initialText, timeZone) : null,
  );
  const [nonexistent, setNonexistent] = useState(() =>
    value === null ? isNonexistent(initialText, timeZone) : false,
  );
  const [invalidTime, setInvalidTime] = useState(false);
  const [open, setOpen] = useState(false);
  const [dateText, timeText = ""] = text.split("T");
  const selectedDate = parseDateValue(dateText ?? "");
  const zoneLabel = `Fuso horário: ${timeZone.replaceAll("_", " ")}`;

  function change(date: string, time: string) {
    const next = date === "" && time === "" ? "" : `${date}T${time}`;
    setText(next);
    setOccurrences(null);
    setNonexistent(false);
    setInvalidTime(false);
    if (date === "" || time === "") {
      onValueChange(null);
      return;
    }
    if (!TIME_PATTERN.test(time)) {
      setInvalidTime(time.length === 5);
      onValueChange(null);
      return;
    }
    const resolved = resolveLocalTime(next, timeZone);
    if (resolved.ok) {
      onValueChange(resolved.instant.toISOString());
      return;
    }
    if (resolved.problem === LocalTimeProblem.Ambiguous) setOccurrences(resolved.options);
    else setNonexistent(true);
  }

  const message = nonexistent
    ? NONEXISTENT_TIME
    : occurrences
      ? AMBIGUOUS_TIME
      : invalidTime
        ? INVALID_TIME
        : error;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <FieldLabel htmlFor={id} tip={hintTip(label, hint)}>
          {label}
        </FieldLabel>
        <InfoTip label={zoneLabel}>{zoneLabel}</InfoTip>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={
                selectedDate
                  ? `Data: ${format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: pt })}`
                  : "Escolher data"
              }
              aria-invalid={message ? true : undefined}
              aria-haspopup="dialog"
              aria-expanded={open}
              className={`h-10 min-w-0 flex-1 justify-start gap-2 px-3 text-left font-normal ${
                selectedDate ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {selectedDate
                  ? format(selectedDate, "d 'de' MMM 'de' yyyy", { locale: pt })
                  : "Escolher data"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto rounded-xl p-2">
            <Calendar
              mode="single"
              locale={pt}
              selected={selectedDate ?? undefined}
              defaultMonth={selectedDate ?? new Date()}
              onSelect={(date) => {
                if (!date) return;
                change(toDateValue(date), timeText);
                setOpen(false);
              }}
              initialFocus
            />
            {selectedDate ? (
              <div className="border-t border-border px-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    change("", "");
                    setOpen(false);
                  }}
                >
                  <X aria-hidden="true" />
                  Limpar data e hora
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
        <div className="relative w-32 shrink-0">
          <Clock3
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            aria-label="Horário"
            inputMode="numeric"
            autoComplete="off"
            maxLength={5}
            placeholder="HH:mm"
            value={timeText}
            disabled={disabled}
            aria-invalid={message ? true : undefined}
            className="h-10 pl-9 pr-2"
            onChange={(event) => change(dateText ?? "", normalizeTime(event.target.value))}
          />
        </div>
      </div>
      {occurrences ? (
        <RadioGroup
          aria-label="Qual ocorrência do horário"
          onValueChange={(chosen) => {
            onValueChange(chosen);
            setOccurrences(null);
          }}
        >
          {occurrences.map((option) => (
            <div key={option.toISOString()} className="flex items-center gap-2">
              <RadioGroupItem id={`${id}-${option.getTime()}`} value={option.toISOString()} />
              <Label htmlFor={`${id}-${option.getTime()}`} className="font-normal">
                {formatInZone(option, timeZone)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      ) : null}
      <FieldMessage error={message} />
    </div>
  );
}
