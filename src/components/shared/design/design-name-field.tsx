import { useState } from "react";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

export function DesignNameField({
  name,
  disabled,
  onRename,
  label = "Nome do design",
  inputId = "design-name",
}: {
  name: string;
  disabled: boolean;
  onRename: (name: string) => Promise<boolean>;
  label?: string;
  inputId?: string;
}) {
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const trimmed = value.trim();
  const invalid = trimmed === "" || trimmed.length > DESIGN_LIMITS.nameMax;

  const commit = async () => {
    if (trimmed === name || saving) return;
    if (invalid) {
      setValue(name);
      return;
    }
    setSaving(true);
    const ok = await onRename(trimmed);
    setSaving(false);
    if (!ok) setValue(name);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Label htmlFor={inputId} className="sr-only">
        {label}
      </Label>
      <Input
        id={inputId}
        value={value}
        maxLength={DESIGN_LIMITS.nameMax}
        disabled={disabled || saving}
        aria-invalid={invalid || undefined}
        className="max-w-md font-medium"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setValue(name);
        }}
      />
    </div>
  );
}
