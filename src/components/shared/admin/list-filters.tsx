import { ListFilter, Eraser, Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/shared/ui/badge";
import { Button } from "@/components/shared/ui/button";
import { Label } from "@/components/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shared/ui/tooltip";
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
  options: { value: string; label: string; icon?: ReactNode }[];
  emptyText?: string | undefined;
  render?: (value: string, onValueChange: (value: string) => void) => ReactNode;
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
  const activeLabel = active === 1 ? "1 filtro ativo" : `${active} filtros ativos`;
  const triggerLabel = active === 0 ? "Filtros" : `Filtros: ${activeLabel}`;

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
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="relative"
                aria-label={triggerLabel}
              >
                <ListFilter aria-hidden="true" />
                {active > 0 ? (
                  <Badge
                    variant="secondary"
                    className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center px-1 text-xs"
                    aria-hidden="true"
                  >
                    {active}
                  </Badge>
                ) : null}
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent className="max-w-64">{triggerLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          {groups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              {group.render ? (
                group.render(valueOf(group), (value) =>
                  setDraft((current) => ({ ...current, [group.id]: value })),
                )
              ) : (
                <>
                  <Label htmlFor={`filter-${group.id}`}>{group.label}</Label>
                  <Select
                    value={valueOf(group)}
                    disabled={group.emptyText !== undefined}
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
                          {option.icon ? (
                            <span className="flex items-center gap-2">
                              {option.icon}
                              {option.label}
                            </span>
                          ) : (
                            option.label
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {group.emptyText ? (
                    <p className="text-xs text-muted-foreground">{group.emptyText}</p>
                  ) : null}
                </>
              )}
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
