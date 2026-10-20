import {
  Ban,
  ClipboardList,
  Hammer,
  MessageSquare,
  RotateCcw,
  Save,
  Send,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconButton } from "@/components/shared/admin/icon-button";
import { WhyDisabled } from "@/components/shared/admin/why-disabled";
import { Button } from "@/components/shared/ui/button";
import type { StageState } from "@/lib/marketing/content/stage-state";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { DirectMoves, submitStageOf } from "@/lib/shared/editorial/editorial";
import { ApprovalStage, EditorialStatus } from "@/lib/shared/enums";

const MOVE_LABELS: Partial<Record<EditorialStatus, { label: string; icon: LucideIcon }>> = {
  [EditorialStatus.Planning]: { label: "Iniciar planejamento", icon: ClipboardList },
  [EditorialStatus.InProduction]: { label: "Iniciar produção", icon: Hammer },
  [EditorialStatus.InternalReview]: { label: "Enviar para revisão interna", icon: MessageSquare },
};

const RESUME_FROM: readonly EditorialStatus[] = [
  EditorialStatus.InternalReview,
  EditorialStatus.ChangesRequested,
];

const REOPEN_ART: readonly EditorialStatus[] = [
  EditorialStatus.Approved,
  EditorialStatus.AwaitingApproval,
];

const REOPEN_PLAN: readonly EditorialStatus[] = [
  EditorialStatus.AwaitingPlanApproval,
  EditorialStatus.PlanApproved,
  EditorialStatus.InProduction,
  EditorialStatus.InternalReview,
  EditorialStatus.AwaitingApproval,
  EditorialStatus.ChangesRequested,
  EditorialStatus.Approved,
];

const moveLabel = (from: EditorialStatus, to: EditorialStatus) => {
  if (from === EditorialStatus.PlanApproved && to === EditorialStatus.InProduction) {
    return { label: "Iniciar produção das artes", icon: Hammer };
  }
  if (RESUME_FROM.includes(from) && to === EditorialStatus.InProduction) {
    return { label: "Retomar produção", icon: Undo2 };
  }
  return MOVE_LABELS[to];
};

const submitLabel = (status: EditorialStatus): string =>
  submitStageOf(status) === ApprovalStage.Plan
    ? "Enviar planejamento para aprovação"
    : "Enviar artes para aprovação";

const movesOf = (status: EditorialStatus, state: StageState): readonly EditorialStatus[] =>
  DirectMoves[status].filter((to) => {
    if (to === EditorialStatus.Planning)
      return state.planRequired && status === EditorialStatus.Draft;
    if (to === EditorialStatus.InProduction && status === EditorialStatus.Draft) {
      return !state.planRequired;
    }
    return true;
  });

export function ContentActions({
  status,
  state,
  isNew,
  cancelled,
  hasPublished,
  canMarkPublished,
  hasContent,
  editable,
  dirty,
  saving,
  acting,
  onMove,
  onSubmit,
  onReopen,
  onCancel,
  onPublish,
}: {
  status: EditorialStatus;
  state: StageState;
  isNew: boolean;
  cancelled: boolean;
  hasPublished: boolean;
  hasContent: boolean;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  acting: boolean;
  onMove: (to: EditorialStatus) => void;
  onSubmit: () => void;
  onReopen: (scope: ApprovalStage) => void;
  onCancel: () => void;
  onPublish: () => void;
  canMarkPublished: boolean;
}) {
  const auth = useAuth();
  const moves =
    hasContent && can(auth, Action.Content.Update) && !cancelled ? movesOf(status, state) : [];
  const canSubmit =
    hasContent && can(auth, Action.Content.Submit) && !cancelled && submitStageOf(status) !== null;
  const reopenAllowed = can(auth, Action.Content.Reopen) && !cancelled && !hasPublished;
  const canReopenArt = reopenAllowed && REOPEN_ART.includes(status);
  const canReopenPlan = reopenAllowed && state.planRequired && REOPEN_PLAN.includes(status);
  const canPublish =
    hasContent &&
    can(auth, Action.Content.PublishManual) &&
    !cancelled &&
    status === EditorialStatus.Approved;
  const canCancel = hasContent && can(auth, Action.Content.Cancel) && !cancelled;

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-1.5"
      role="group"
      aria-label="Ações do conteúdo"
    >
      {moves.map((to) => {
        const meta = moveLabel(status, to);
        if (meta === undefined) return null;
        const Icon = meta.icon;
        return (
          <WhyDisabled
            key={to}
            reason={dirty ? "Salve as alterações antes de mudar o estado." : null}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={dirty || acting}
              onClick={() => onMove(to)}
            >
              <Icon aria-hidden="true" />
              {meta.label}
            </Button>
          </WhyDisabled>
        );
      })}
      {canSubmit ? (
        <Button type="button" size="sm" onClick={onSubmit} disabled={acting}>
          <Send aria-hidden="true" />
          {submitLabel(status)}
        </Button>
      ) : null}
      {canReopenPlan ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onReopen(ApprovalStage.Plan)}
          disabled={acting}
        >
          <ClipboardList aria-hidden="true" />
          Reabrir planejamento
        </Button>
      ) : null}
      {canReopenArt ? (
        <IconButton
          variant="outline"
          icon={RotateCcw}
          label="Reabrir artes"
          onClick={() => onReopen(ApprovalStage.Art)}
          disabled={acting}
        />
      ) : null}
      {canPublish ? (
        <WhyDisabled
          reason={canMarkPublished ? null : "Registre a publicação de todos os canais antes."}
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onPublish}
            disabled={acting || !canMarkPublished}
          >
            <Send aria-hidden="true" />
            Marcar como publicado
          </Button>
        </WhyDisabled>
      ) : null}
      {canCancel ? (
        <IconButton
          variant="outline"
          icon={Ban}
          label="Cancelar conteúdo"
          destructive
          onClick={onCancel}
          disabled={acting}
        />
      ) : null}
      {editable ? (
        <Button type="submit" size="sm" loading={saving} disabled={saving || (!isNew && !dirty)}>
          <Save aria-hidden="true" />
          {isNew ? "Criar conteúdo" : "Salvar"}
        </Button>
      ) : null}
    </div>
  );
}
