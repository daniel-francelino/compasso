import { SectionCard } from "@/components/shared/admin/section-card";
import { Skeleton } from "@/components/shared/ui/skeleton";

export function FeedSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando conteúdos" className="space-y-4">
      {Array.from({ length: rows }, (_, index) => (
        <SectionCard key={index} padding="none" className="mx-auto w-full max-w-lg overflow-hidden">
          <div className="flex items-center gap-3 p-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48 max-w-full" />
            </div>
          </div>
          <Skeleton className="aspect-4/5 w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
