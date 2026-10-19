import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  type LucideIcon,
  RotateCw,
} from "lucide-react";
import type { ReactNode } from "react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Button } from "@/components/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
import { WhyDisabled } from "@/components/shared/admin/why-disabled";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { Checkbox } from "@/components/shared/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shared/ui/table";
import type { ListSort } from "@/lib/shared/list-sort";
import { cn } from "@/lib/shared/utils";
import { PaginationBar } from "./pagination-bar";
import { SortDirection } from "@/lib/shared/list-sort";

export type DataTableColumn<T> = {
  id: string;
  label: string;
  cell: (row: T) => ReactNode;
  className?: string;
  sortable?: boolean;
};

export type DataTableAction<T> = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: (row: T) => void;
  destructive?: boolean;
  disabled?: boolean;
  disabledReason?: string | undefined;
};

export function DataTableRowActions<T>({
  row,
  label,
  actions,
  disabled = false,
}: {
  row: T;
  label: string;
  actions: DataTableAction<T>[];
  disabled?: boolean;
}) {
  if (!actions.length) return null;
  if (actions.length > 2) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            disabled={disabled}
            aria-label={`Ações de ${label}`}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) => (
            <WhyDisabled key={action.id} reason={action.disabledReason} inMenu>
              <DropdownMenuItem
                disabled={(action.disabled ?? false) || !!action.disabledReason}
                onSelect={() => action.onSelect(row)}
                className={cn(action.destructive && "text-destructive focus:text-destructive")}
              >
                <action.icon className="size-4" aria-hidden="true" />
                {action.label}
              </DropdownMenuItem>
            </WhyDisabled>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <div className="flex justify-end gap-1">
      {actions.map((action) => (
        <WhyDisabled key={action.id} reason={action.disabledReason}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-11",
              action.destructive && "text-destructive hover:text-destructive",
            )}
            disabled={disabled || action.disabled || !!action.disabledReason}
            aria-label={
              action.disabledReason
                ? `${action.label}: ${label}. ${action.disabledReason}`
                : `${action.label}: ${label}`
            }
            title={action.disabledReason ? undefined : action.label}
            onClick={() => action.onSelect(row)}
          >
            <action.icon aria-hidden="true" />
          </Button>
        </WhyDisabled>
      ))}
    </div>
  );
}

function SortHeaderButton({
  label,
  dir,
  disabled,
  onClick,
}: {
  label: string;
  dir: "asc" | "desc" | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={dir === "asc" ? "Crescente" : dir === "desc" ? "Decrescente" : "Ordenar"}
      className="-mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none"
    >
      {label}
      <Icon
        aria-hidden="true"
        className={cn("size-3.5", dir ? "text-foreground" : "text-muted-foreground/60")}
      />
    </button>
  );
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowLabel,
  actions,
  caption,
  loading = false,
  refreshing = false,
  error,
  onRetry,
  empty,
  pagination,
  selection,
  sort,
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  rowLabel: (row: T) => string;
  actions?: ((row: T) => DataTableAction<T>[]) | undefined;
  caption: string;
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: ReactNode;
  selection?:
    | {
        selectedIds: string[];
        onChange: (ids: string[]) => void;
        disabled?: boolean;
        rowDisabledReason?: (row: T) => string | null | undefined;
      }
    | undefined;
  sort?: { current: ListSort; onToggle: (key: string) => void } | undefined;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}) {
  const count = columns.length + (actions ? 1 : 0) + (selection ? 1 : 0);
  const pageIds = rows.filter((row) => !selection?.rowDisabledReason?.(row)).map(rowKey);
  const selectedOnPage = pageIds.filter((id) => selection?.selectedIds.includes(id)).length;
  const allPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const somePageSelected = selectedOnPage > 0 && !allPageSelected;

  function togglePage(checked: boolean) {
    if (!selection) return;
    const pageIdSet = new Set(pageIds);
    selection.onChange(
      checked
        ? [...new Set([...selection.selectedIds, ...pageIds])]
        : selection.selectedIds.filter((id) => !pageIdSet.has(id)),
    );
  }

  function toggleRow(id: string, checked: boolean) {
    if (!selection) return;
    selection.onChange(
      checked
        ? [...new Set([...selection.selectedIds, id])]
        : selection.selectedIds.filter((selectedId) => selectedId !== id),
    );
  }

  if (!loading && !error && rows.length === 0 && empty !== undefined) return <>{empty}</>;

  return (
    <div className="space-y-4" aria-busy={loading || refreshing}>
      <SectionCard as="div" padding="none" className="overflow-hidden">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              {selection ? (
                <TableHead scope="col" className="w-12 px-4">
                  <Checkbox
                    aria-label="Selecionar todas as linhas desta página"
                    className="rounded-none"
                    checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                    disabled={loading || refreshing || selection.disabled}
                    onCheckedChange={(checked) => togglePage(checked === true)}
                  />
                </TableHead>
              ) : null}
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  scope="col"
                  className={cn("px-4", column.className)}
                  aria-sort={
                    sort && column.sortable
                      ? sort.current?.key !== column.id
                        ? "none"
                        : sort.current.dir === SortDirection.Asc
                          ? "ascending"
                          : "descending"
                      : undefined
                  }
                >
                  {sort && column.sortable ? (
                    <SortHeaderButton
                      label={column.label}
                      dir={sort.current?.key === column.id ? sort.current.dir : null}
                      disabled={loading || refreshing}
                      onClick={() => sort.onToggle(column.id)}
                    />
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
              {actions ? (
                <TableHead scope="col" className="w-28 px-4 text-right">
                  Ações
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }, (_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: count }, (_, cell) => (
                    <TableCell key={cell} className="p-4">
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={count} className="p-6 text-center">
                  <p role="alert">{error}</p>
                  {onRetry ? (
                    <Button className="mt-3" variant="outline" onClick={onRetry}>
                      <RotateCw aria-hidden="true" />
                      Tentar novamente
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={count} className="p-6">
                  {empty ?? <p className="text-center text-muted-foreground">Sem registros.</p>}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={rowKey(row)} className={cn(refreshing && "opacity-60")}>
                  {selection ? (
                    <TableCell className="w-12 px-4">
                      <WhyDisabled reason={selection.rowDisabledReason?.(row)}>
                        <Checkbox
                          aria-label={`Selecionar ${rowLabel(row)}`}
                          className="rounded-none"
                          checked={selection.selectedIds.includes(rowKey(row))}
                          disabled={
                            refreshing || selection.disabled || !!selection.rowDisabledReason?.(row)
                          }
                          onCheckedChange={(checked) => toggleRow(rowKey(row), checked === true)}
                        />
                      </WhyDisabled>
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell key={column.id} className={cn("px-4 py-3", column.className)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {actions ? (
                    <TableCell className="px-4 text-right">
                      <DataTableRowActions
                        row={row}
                        label={rowLabel(row)}
                        actions={actions(row)}
                        disabled={refreshing}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </SectionCard>
      {pagination && !loading && !error && pagination.total > 0 ? (
        <PaginationBar {...pagination} disabled={refreshing} />
      ) : null}
    </div>
  );
}
