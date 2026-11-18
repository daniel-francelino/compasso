import { History } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import type { TimelineStep } from "@/lib/shared/design/timeline";
import { cn } from "@/lib/shared/utils";

const INITIAL_LABEL = "Estado inicial";

function StepButton({
  label,
  current,
  muted,
  disabled,
  onClick,
}: {
  label: string;
  current: boolean;
  muted: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={current ? "step" : undefined}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "w-full rounded px-2 py-1.5 text-left hover:bg-accent/60 disabled:cursor-default",
          muted ? "text-muted-foreground" : "text-foreground",
          current && "bg-accent text-accent-foreground",
        )}
      >
        {label}
        {muted ? <span className="sr-only"> (desfeito)</span> : null}
      </button>
    </li>
  );
}

export function DesignHistoryPanel({
  steps,
  disabled,
  onJump,
}: {
  steps: readonly TimelineStep[];
  disabled: boolean;
  onJump: (stepIndex: number) => void;
}) {
  if (steps.length === 0) {
    return (
      <EmptyState
        compact
        icon={History}
        title="Nenhum passo ainda"
        description="Cada alteração e cada pincelada aparecem aqui. Clique em um passo para voltar a ele."
      />
    );
  }
  const current = steps.filter((step) => step.applied).length - 1;
  return (
    <ol aria-label="Passos do histórico" className="space-y-1 p-3 text-sm">
      <StepButton
        label={INITIAL_LABEL}
        current={current === -1}
        muted={false}
        disabled={disabled}
        onClick={() => onJump(-1)}
      />
      {steps.map((step, index) => (
        <StepButton
          key={`${index}-${step.label}`}
          label={step.label}
          current={index === current}
          muted={!step.applied}
          disabled={disabled}
          onClick={() => onJump(index)}
        />
      ))}
    </ol>
  );
}
