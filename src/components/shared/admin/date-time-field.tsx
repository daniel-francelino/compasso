import { useState } from "react";
import { hintTip } from "@/components/shared/admin/field-tip";
import { FieldLabel, FieldMessage } from "@/components/shared/admin/form-fields";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/shared/ui/radio-group";
import { LocalTimeProblem, resolveLocalTime } from "@/lib/shared/calendar/reschedule";
import { formatInZone, instantToLocalInput } from "@/lib/shared/format";

const NONEXISTENT_TIME = "Este horário não existe nesse dia (mudança de horário de verão).";
const AMBIGUOUS_TIME = "Este horário acontece duas vezes nesse dia. Escolha qual.";

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
  const [text, setText] = useState(
    value === null ? (initialLocal ?? "") : instantToLocalInput(value, timeZone),
  );
  const [occurrences, setOccurrences] = useState<Occurrences>(() =>
    value === null ? occurrencesOf(initialLocal ?? "", timeZone) : null,
  );
  const [nonexistent, setNonexistent] = useState(() =>
    value === null ? isNonexistent(initialLocal ?? "", timeZone) : false,
  );

  function change(next: string) {
    setText(next);
    setOccurrences(null);
    setNonexistent(false);
    if (next === "") {
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

  const message = nonexistent ? NONEXISTENT_TIME : occurrences ? AMBIGUOUS_TIME : error;
  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} tip={hintTip(label, hint)}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        type="datetime-local"
        className="h-11 md:h-10"
        value={text}
        disabled={disabled}
        aria-invalid={message ? true : undefined}
        aria-describedby={`${id}-zone`}
        onChange={(event) => change(event.target.value)}
      />
      <p id={`${id}-zone`} className="text-xs text-muted-foreground">
        Fuso horário: {timeZone.replaceAll("_", " ")}
      </p>
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
