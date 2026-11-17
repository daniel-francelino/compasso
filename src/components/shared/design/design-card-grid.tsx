import { CircleAlert, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PaginationBar } from "@/components/shared/admin/pagination-bar";
import { type DesignCardAction, DesignCard } from "@/components/shared/design/design-card";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import type { DesignRow } from "@/lib/shared/design/design.functions";

const GRID =
  "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
const SKELETON_CARDS = 10;

export function DesignCardGrid({
  title,
  rows,
  total,
  page,
  pageSize,
  loading,
  refreshing,
  error,
  onRetry,
  onPageChange,
  thumbUrls,
  actionsFor,
  empty,
}: {
  title: string;
  rows: DesignRow[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  thumbUrls: Record<string, string> | undefined;
  actionsFor: (row: DesignRow) => DesignCardAction[];
  empty: ReactNode;
}) {
  return (
    <section aria-labelledby="design-grid-title" aria-busy={loading || refreshing}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id="design-grid-title" className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {loading || error !== null ? null : (
          <span className="text-sm text-muted-foreground">
            {total === 1 ? "1 design" : `${total} designs`}
          </span>
        )}
      </div>
      {loading ? (
        <ul className={GRID} aria-label="Carregando designs">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <li key={index} className="space-y-2">
              <Skeleton className="aspect-4/3 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && error !== null ? (
        <EmptyState
          icon={CircleAlert}
          title="Não foi possível carregar os designs"
          description={error}
          action={
            <Button type="button" variant="outline" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              Tentar de novo
            </Button>
          }
        />
      ) : null}
      {!loading && error === null && rows.length === 0 ? empty : null}
      {!loading && error === null && rows.length > 0 ? (
        <ul className={GRID}>
          {rows.map((row) => (
            <DesignCard
              key={row.id}
              row={row}
              thumbUrl={row.thumbVersionId === null ? undefined : thumbUrls?.[row.thumbVersionId]}
              actions={actionsFor(row)}
            />
          ))}
        </ul>
      ) : null}
      {!loading && total > 0 ? (
        <div className="mt-6">
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
            disabled={refreshing}
          />
        </div>
      ) : null}
    </section>
  );
}
