import { EmptyState } from "@/components/shared/admin/empty-state";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Trash2, LayoutTemplate } from "lucide-react";
import { IconButton } from "@/components/shared/admin/icon-button";
import { componentRegistry } from "@/lib/shared/content/registry";
import type { DraftSection } from "@/lib/shared/content/schemas";
import { cn } from "@/lib/shared/utils";

export function SectionList({
  sections,
  selectedId,
  canEdit,
  onSelect,
  onMove,
  onToggle,
  onDuplicate,
  onRemove,
}: {
  sections: DraftSection[];
  selectedId: string;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onToggle: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (sections.length === 0) {
    return (
      <EmptyState
        compact
        icon={LayoutTemplate}
        title="Nenhuma seção"
        description="Adicione a primeira seção desta página."
      />
    );
  }
  return (
    <ol className="space-y-2">
      {sections.map((section, index) => (
        <li
          key={section.id}
          className={cn(
            "rounded-lg border border-border p-2",
            selectedId === section.id && "border-primary bg-accent",
          )}
        >
          <button
            type="button"
            aria-current={selectedId === section.id ? "true" : undefined}
            className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => onSelect(section.id)}
          >
            <span className="text-muted-foreground">{index + 1}.</span>
            {componentRegistry[section.component].label}
            {section.visible ? null : (
              <span className="text-xs font-normal text-muted-foreground">(oculta)</span>
            )}
          </button>
          {canEdit ? (
            <div className="flex flex-wrap gap-1">
              <IconButton
                label={`Subir a seção ${index + 1}`}
                icon={ArrowUp}
                disabled={index === 0}
                onClick={() => onMove(section.id, -1)}
              />
              <IconButton
                label={`Descer a seção ${index + 1}`}
                icon={ArrowDown}
                disabled={index === sections.length - 1}
                onClick={() => onMove(section.id, 1)}
              />
              <IconButton
                label={
                  section.visible ? `Ocultar a seção ${index + 1}` : `Mostrar a seção ${index + 1}`
                }
                icon={section.visible ? EyeOff : Eye}
                onClick={() => onToggle(section.id)}
              />
              <IconButton
                label={`Duplicar a seção ${index + 1}`}
                icon={Copy}
                onClick={() => onDuplicate(section.id)}
              />
              <IconButton
                label={`Excluir a seção ${index + 1}`}
                icon={Trash2}
                destructive
                onClick={() => onRemove(section.id)}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
