import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { FieldLabel, FieldMessage } from "@/components/shared/admin/form-fields";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Input } from "@/components/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";

export type MultiSelectOption = { value: string; label: string; display?: ReactNode };

const plain = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function MultiSelectField({
  id,
  label,
  tip,
  options,
  value,
  onValueChange,
  placeholder,
  searchLabel,
  emptyText,
  error,
  disabled = false,
  trailing,
}: {
  id: string;
  label: string;
  tip?: { label: string; content: ReactNode } | undefined;
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder: string;
  searchLabel: string;
  emptyText: string;
  error?: string | undefined;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.filter((option) => value.includes(option.value));
  const needle = plain(search.trim());
  const visible = options.filter((option) => plain(option.label).includes(needle));

  const toggle = (optionValue: string, checked: boolean) =>
    onValueChange(
      checked ? [...value, optionValue] : value.filter((current) => current !== optionValue),
    );

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} tip={tip}>
        {label}
      </FieldLabel>
      <div className="flex items-start gap-2">
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setSearch("");
          }}
        >
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-invalid={error ? true : undefined}
              className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {selected.length === 0 ? (
                  <span className="text-muted-foreground">{placeholder}</span>
                ) : (
                  selected.map((option) => (
                    <span key={option.value} className="max-w-full">
                      {option.display ?? option.label}
                    </span>
                  ))
                )}
              </span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) space-y-2 p-2">
            <Input
              value={search}
              aria-label={searchLabel}
              placeholder={searchLabel}
              className="h-10"
              onChange={(event) => setSearch(event.target.value)}
            />
            <ul
              role="listbox"
              aria-label={label}
              aria-multiselectable="true"
              className="max-h-60 space-y-0.5 overflow-y-auto"
            >
              {visible.map((option) => {
                const checked = value.includes(option.value);
                return (
                  <li key={option.value} role="option" aria-selected={checked}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/60 md:min-h-9">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => toggle(option.value, next === true)}
                      />
                      <span className="min-w-0 text-sm">{option.display ?? option.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {visible.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p>
            ) : null}
            {value.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onValueChange([])}>
                Limpar seleção
              </Button>
            ) : null}
          </PopoverContent>
        </Popover>
        {trailing}
      </div>
      <FieldMessage error={error} />
    </div>
  );
}
