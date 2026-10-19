import { Eraser } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { Button } from "@/components/shared/ui/button";

export function SearchableEmptyState({
  icon,
  search,
  onClearSearch,
  emptyTitle,
  emptyDescription,
  noResultsDescription = "Tente outro nome ou altere os filtros.",
}: {
  icon: LucideIcon;
  search: string;
  onClearSearch: () => void;
  emptyTitle: string;
  emptyDescription: string;
  noResultsDescription?: string;
}) {
  return (
    <EmptyState
      icon={icon}
      title={search ? "Nenhum resultado" : emptyTitle}
      description={search ? noResultsDescription : emptyDescription}
      action={
        search ? (
          <Button variant="outline" onClick={onClearSearch}>
            <Eraser aria-hidden="true" />
            Limpar pesquisa
          </Button>
        ) : undefined
      }
    />
  );
}
