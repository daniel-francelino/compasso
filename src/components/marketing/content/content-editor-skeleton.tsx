import { Skeleton } from "@/components/shared/ui/skeleton";

function PropertySkeleton({ stacked = false }: { stacked?: boolean }) {
  return (
    <div
      className={
        stacked ? "space-y-2 py-1" : "grid gap-x-4 gap-y-2 py-1 sm:grid-cols-[11rem_minmax(0,1fr)]"
      }
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

export function ContentEditorSkeleton({ isNew = false }: { isNew?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Carregando conteúdo"
      aria-busy="true"
      className="mx-auto w-full max-w-4xl space-y-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </header>
      <Skeleton className="h-12 w-3/4 max-w-xl" aria-hidden="true" />
      <div className="space-y-2 border-y border-border py-3" aria-hidden="true">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))] gap-x-4 gap-y-3">
          {isNew ? <PropertySkeleton stacked /> : null}
          <PropertySkeleton stacked />
          <PropertySkeleton stacked />
        </div>
        <PropertySkeleton />
        <div className="grid gap-x-4 gap-y-2 py-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="size-11 rounded-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-72 w-full rounded-md" />
      </div>
    </div>
  );
}
