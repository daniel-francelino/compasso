import { History } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import type { TimelineStep } from "@/lib/shared/design/timeline";
import { cn } from "@/lib/shared/utils";

export function DesignHistoryPanel({ steps }: { steps: readonly TimelineStep[] }) {
  if (steps.length === 0) {
    return (
      <EmptyState
        compact
        icon={History}
        title="Nenhum passo ainda"
        description="Cada alteração e cada pincelada aparecem aqui. Use Desfazer e Refazer para voltar."
      />
    );
  }
  const current = steps.filter((step) => step.applied).length - 1;
  return (
    <ol aria-label="Passos do histórico" className="space-y-1 p-3 text-sm">
      {steps.map((step, index) => (
        <li
          key={index}
          aria-current={index === current ? "step" : undefined}
          className={cn(
            "rounded px-2 py-1.5",
            step.applied ? "text-foreground" : "text-muted-foreground",
            index === current && "bg-accent text-accent-foreground",
          )}
        >
          {step.label}
          {step.applied ? null : <span className="sr-only"> (desfeito)</span>}
        </li>
      ))}
    </ol>
  );
}
