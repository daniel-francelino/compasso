import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/shared/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";

export type StatusOption = { value: string; label: string; icon?: LucideIcon };

export function ListToolbar({
  search,
  onSearchChange,
  searchLabel,
  statusOptions,
  status,
  onStatusChange,
  hideSearch = false,
  extra,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  statusOptions?: StatusOption[];
  status?: string;
  onStatusChange?: (value: string) => void;
  hideSearch?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {statusOptions && status !== undefined && onStatusChange ? (
        <Tabs value={status} onValueChange={onStatusChange}>
          <TabsList>
            {statusOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.icon ? <option.icon aria-hidden="true" /> : null}
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : (
        <span />
      )}
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        {extra}
        {hideSearch ? null : (
          <Input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
            maxLength={80}
            className="sm:w-72"
          />
        )}
      </div>
    </div>
  );
}
