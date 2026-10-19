import { ListFilter, Eraser, Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/shared/ui/badge";
import { Button } from "@/components/shared/ui/button";
import { Label } from "@/components/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/ui/select";

export type FilterGroup = {
  id: string;
  label: string;
  value: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

export function ListFilters({
  groups,
  children,
  extraActive = 0,
  onClear,
}: {
  groups: FilterGroup[];
  children?: ReactNode;
  extraActive?: number;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const active = groups.filter((group) => group.value !== group.defaultValue).length + extraActive;

  const valueOf = (group: FilterGroup) => draft[group.id] ?? group.value;

  function onOpenChange(next: boolean) {
    if (next) setDraft(Object.fromEntries(groups.map((group) => [group.id, group.value])));
    setOpen(next);
  }

  function apply() {
    for (const group of groups) {
      const value = valueOf(group);
      if (value !== group.value) group.onChange(value);
    }
    setOpen(false);
  }

  function clear() {
    for (const group of groups) {
      if (group.value !== group.defaultValue) group.onChange(group.defaultValue);
    }
    onClear?.();
    setOpen(false);
  }

  return (
    <Popover modal open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-center sm:w-auto">
          <ListFilter aria-hidden="true" />
          Filtros
          {active > 0 ? (
            <Badge
              variant="secondary"
              className="ml-1 px-1.5"
              aria-label={`${active} filtros ativos`}
            >
              {active}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          {groups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              <Label htmlFor={`filter-${group.id}`}>{group.label}</Label>
              <Select
                value={valueOf(group)}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, [group.id]: value }))
                }
              >
                <SelectTrigger id={`filter-${group.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {group.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {children}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Eraser aria-hidden="true" />
            Limpar
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            <Check aria-hidden="true" />
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
