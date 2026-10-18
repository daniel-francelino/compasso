import { useState } from "react";
import { FieldLabel, FieldMessage } from "@/components/shared/admin/form-fields";
import { Input } from "@/components/shared/ui/input";
import { instantToLocalInput, localInputToInstant } from "@/lib/shared/format";

const NONEXISTENT_TIME = "Este horário não existe nesse dia (mudança de horário de verão).";

export function DateTimeField({
  id,
  label,
  value,
  timeZone,
  onValueChange,
  error,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  value: string | null;
  timeZone: string;
  onValueChange: (instant: string | null) => void;
  error?: string | undefined;
  hint?: string | undefined;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : instantToLocalInput(value, timeZone));
  const [invalid, setInvalid] = useState(false);

  function change(next: string) {
    setText(next);
    if (next === "") {
      setInvalid(false);
      onValueChange(null);
      return;
    }
    const instant = localInputToInstant(next, timeZone);
    setInvalid(instant === null);
    if (instant !== null) onValueChange(instant.toISOString());
  }

  const message = invalid ? NONEXISTENT_TIME : error;
  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
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
      <FieldMessage error={message} hint={hint} />
    </div>
  );
}
