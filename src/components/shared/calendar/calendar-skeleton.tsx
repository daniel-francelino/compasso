import { Skeleton } from "@/components/shared/ui/skeleton";

export function CalendarSkeleton({ weeks = 1 }: { weeks?: number }) {
  return (
    <div
      role="status"
      aria-label="Carregando calendário"
      aria-busy="true"
      className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border"
    >
      {Array.from({ length: weeks * 7 }, (_, index) => (
        <div key={index} className="min-h-32 space-y-2 bg-background p-2" aria-hidden="true">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-6 w-full rounded-md" />
          {index % 3 === 0 ? <Skeleton className="h-6 w-4/5 rounded-md" /> : null}
        </div>
      ))}
    </div>
  );
}
