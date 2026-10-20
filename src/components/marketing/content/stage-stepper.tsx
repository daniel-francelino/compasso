import { CircleCheck, ClipboardList, Hammer, Hourglass, Lock, Undo2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import type { StageState, StepStatus } from "@/lib/marketing/content/stage-state";

const style: Record<StepStatus, { tone: StatusTone; icon: typeof Lock; label: string }> = {
  locked: { tone: "neutral", icon: Lock, label: "Liberado depois do planejamento" },
  todo: { tone: "draft", icon: ClipboardList, label: "A iniciar" },
  doing: { tone: "info", icon: Hammer, label: "Em andamento" },
  reviewing: { tone: "warning", icon: Hourglass, label: "Em aprovação" },
  changes: { tone: "negative", icon: Undo2, label: "Alterações pedidas" },
  done: { tone: "success", icon: CircleCheck, label: "Aprovado" },
};

function Step({ title, status }: { title: string; status: StepStatus }) {
  const { tone, icon, label } = style[status];
  return (
    <li className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <StatusBadge tone={tone} icon={icon}>
        {label}
      </StatusBadge>
    </li>
  );
}

export function StageStepper({ state }: { state: StageState }) {
  if (!state.planRequired) return null;
  return (
    <ol aria-label="Etapas de aprovação" className="flex flex-col gap-2 sm:flex-row">
      <Step title="1. Planejamento" status={state.plan} />
      <Step title="2. Artes" status={state.art} />
    </ol>
  );
}
