import {
  type DateRangeValue,
  type FormInputDateValue,
  FormInputDate,
} from "lost-ui/forms/form-input-date";
import { parseDateValue, toDateValue } from "@/lib/shared/dates";

const rangeOf = (value: FormInputDateValue): DateRangeValue =>
  value === null || "getTime" in value ? {} : value;

export function ContentPeriodFilter({
  from,
  to,
  onChange,
}: {
  from: string | undefined;
  to: string | undefined;
  onChange: (from: string | undefined, to: string | undefined) => void;
}) {
  const start = from === undefined ? undefined : parseDateValue(from);
  const end = to === undefined ? undefined : parseDateValue(to);
  return (
    <FormInputDate
      mode="range"
      name="period"
      placeholder="Período"
      aria-label="Filtrar por período"
      className="w-full sm:w-64"
      clearable
      presets
      value={{ ...(start ? { from: start } : {}), ...(end ? { to: end } : {}) }}
      onValueChange={(value) => {
        const range = rangeOf(value);
        onChange(
          range.from === undefined ? undefined : toDateValue(range.from),
          range.to === undefined ? undefined : toDateValue(range.to),
        );
      }}
    />
  );
}
