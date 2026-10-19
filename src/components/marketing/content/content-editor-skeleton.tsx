import {
  Calendar,
  FileImage,
  History,
  MessageSquare,
  Radio,
  Settings2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Skeleton } from "@/components/shared/ui/skeleton";

function FieldSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className={`h-10 w-full rounded-lg ${className}`} />
    </div>
  );
}

function ContentSectionSkeleton({
  title,
  icon,
  rows = 2,
}: {
  title: string;
  icon: LucideIcon;
  rows?: number;
}) {
  return (
    <SectionCard title={title} icon={icon} aria-hidden="true">
      <div className="space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          <FieldSkeleton key={index} />
        ))}
      </div>
    </SectionCard>
  );
}

export function ContentEditorSkeleton({ isNew = false }: { isNew?: boolean }) {
  return (
    <div role="status" aria-label="Carregando conteúdo" aria-busy="true" className="space-y-6">
      <header className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>
      <div className="flex justify-end gap-2" aria-hidden="true">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          {isNew ? <ContentSectionSkeleton title="Marca" icon={Radio} rows={1} /> : null}
          <ContentSectionSkeleton title="1. Selecione os canais" icon={Radio} rows={2} />
          <ContentSectionSkeleton title="2. Texto do post" icon={Type} rows={2} />
          <ContentSectionSkeleton title="3. Mídias" icon={FileImage} rows={1} />
          <ContentSectionSkeleton
            title="4. Data e horário das publicações"
            icon={Calendar}
            rows={2}
          />
          <ContentSectionSkeleton title="5. Configurações" icon={Settings2} rows={3} />
        </div>
        <aside className="space-y-6 xl:sticky xl:top-4" aria-hidden="true">
          <SectionCard title="Pré-visualização">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </SectionCard>
          {!isNew ? (
            <>
              <ContentSectionSkeleton title="Versões enviadas e decisões" icon={History} rows={2} />
              <ContentSectionSkeleton title="Comentários" icon={MessageSquare} rows={2} />
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
