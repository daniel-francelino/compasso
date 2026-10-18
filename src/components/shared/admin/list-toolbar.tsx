import { Search } from "lucide-react";
import { Input } from "@/components/shared/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";

export type StatusOption = { value: string; label: string };

export function ListToolbar({
  search,
  onSearchChange,
  searchLabel,
  statusOptions,
  status,
  onStatusChange,
  hideSearch = false,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  statusOptions?: StatusOption[];
  status?: string;
  onStatusChange?: (value: string) => void;
  hideSearch?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {statusOptions && status !== undefined && onStatusChange ? (
        <Tabs value={status} onValueChange={onStatusChange}>
          <TabsList>
            {statusOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : (
        <span />
      )}
      {hideSearch ? null : (
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
            className="h-11 pl-9 md:h-10"
          />
        </div>
      )}
    </div>
  );
}
