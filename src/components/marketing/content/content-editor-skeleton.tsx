import { ClipboardList, Radio, Settings2, Tag, type LucideIcon } from "lucide-react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Skeleton } from "@/components/shared/ui/skeleton";

function FieldSkeleton({ height = "h-10" }: { height?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className={`${height} w-full rounded-lg`} />
    </div>
  );
}

function CardSkeleton({
  title,
  icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <SectionCard title={title} icon={icon} aria-hidden="true">
      {children}
    </SectionCard>
  );
}

export function ContentEditorSkeleton({ isNew = false }: { isNew?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Carregando conteúdo"
      aria-busy="true"
      className="mx-auto w-full max-w-7xl space-y-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </header>
      <div className="flex items-center gap-3" aria-hidden="true">
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <CardSkeleton title="Identificação" icon={Tag}>
        <div className={isNew ? "grid gap-4 md:grid-cols-2" : undefined}>
          {isNew ? <FieldSkeleton /> : null}
          <FieldSkeleton />
        </div>
      </CardSkeleton>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <CardSkeleton title="1. Selecione os canais" icon={Radio}>
            <div className="flex gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="size-11 rounded-full" />
              ))}
            </div>
          </CardSkeleton>
          <CardSkeleton title="Organização" icon={Settings2}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          </CardSkeleton>
        </div>
        <CardSkeleton title="2. Planejamento" icon={ClipboardList}>
          <FieldSkeleton height="h-32" />
        </CardSkeleton>
      </div>
    </div>
  );
}
