import {
  Ban,
  ClipboardList,
  Copy,
  Hammer,
  MessageSquare,
  MoreHorizontal,
  RotateCcw,
  Save,
  Send,
  Undo2,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { WhyDisabled } from "@/components/shared/admin/why-disabled";
import { Button } from "@/components/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
import type { StageState } from "@/lib/marketing/content/stage-state";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { DirectMoves, approveStageOf, submitStageOf } from "@/lib/shared/editorial/editorial";
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
  submitStageOf(status) === ApprovalStage.Plan ? "Enviar para aprovação" : "Enviar para aprovação";

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
  onApproveOnBehalf,
  onReopen,
  onCancel,
  onDuplicate,
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
  onApproveOnBehalf: (stage: ApprovalStage) => void;
  onReopen: (scope: ApprovalStage) => void;
  onCancel: () => void;
  onDuplicate: () => void;
  onPublish: () => void;
  canMarkPublished: boolean;
}) {
  const auth = useAuth();
  const moves =
    hasContent && can(auth, Action.Content.Update) && !cancelled ? movesOf(status, state) : [];
  const canSubmit =
    hasContent && can(auth, Action.Content.Submit) && !cancelled && submitStageOf(status) !== null;
  const approveStage =
    hasContent && can(auth, Action.Approvals.Override) && !cancelled
      ? approveStageOf(status, state.planRequired, state.planLocked)
      : null;
  const reopenAllowed = can(auth, Action.Content.Reopen) && !cancelled && !hasPublished;
  const canReopenArt = reopenAllowed && REOPEN_ART.includes(status);
  const canReopenPlan = reopenAllowed && state.planRequired && REOPEN_PLAN.includes(status);
  const canPublish =
    hasContent &&
    can(auth, Action.Content.PublishManual) &&
    !cancelled &&
    status === EditorialStatus.Approved;
  const canCancel = hasContent && can(auth, Action.Content.Cancel) && !cancelled;
  const canDuplicate = hasContent && can(auth, Action.Content.Create);

  const [primaryMove, ...otherMoves] = moves;
  const hasMenu =
    otherMoves.length > 0 ||
    approveStage !== null ||
    canReopenPlan ||
    canReopenArt ||
    canPublish ||
    canDuplicate ||
    canCancel;
  const approveLabel =
    approveStage === ApprovalStage.Plan ? "Aprovar planejamento" : "Aprovar artes";
  const primaryMeta = primaryMove === undefined ? undefined : moveLabel(status, primaryMove);

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-1.5"
      role="group"
      aria-label="Ações do conteúdo"
    >
      {primaryMove !== undefined && primaryMeta !== undefined ? (
        <WhyDisabled reason={dirty ? "Salve as alterações antes de mudar o estado." : null}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={dirty || acting}
            onClick={() => onMove(primaryMove)}
          >
            <primaryMeta.icon aria-hidden="true" />
            {primaryMeta.label}
          </Button>
        </WhyDisabled>
      ) : null}
      {canSubmit ? (
        <Button type="button" size="sm" onClick={onSubmit} disabled={acting}>
          <Send aria-hidden="true" />
          {submitLabel(status)}
        </Button>
      ) : null}
      {editable ? (
        <Button type="submit" size="sm" loading={saving} disabled={saving || (!isNew && !dirty)}>
          <Save aria-hidden="true" />
          {isNew ? "Criar conteúdo" : "Salvar"}
        </Button>
      ) : null}
      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Mais ações do conteúdo"
              disabled={acting}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {otherMoves.map((to) => {
              const meta = moveLabel(status, to);
              if (meta === undefined) return null;
              const Icon = meta.icon;
              return (
                <DropdownMenuItem key={to} disabled={dirty} onSelect={() => onMove(to)}>
                  <Icon aria-hidden="true" />
                  {meta.label}
                </DropdownMenuItem>
              );
            })}
            {approveStage !== null ? (
              <DropdownMenuItem disabled={dirty} onSelect={() => onApproveOnBehalf(approveStage)}>
                <UserCheck aria-hidden="true" />
                {dirty ? `${approveLabel} (salve antes)` : approveLabel}
              </DropdownMenuItem>
            ) : null}
            {canReopenPlan ? (
              <DropdownMenuItem onSelect={() => onReopen(ApprovalStage.Plan)}>
                <ClipboardList aria-hidden="true" />
                Reabrir planejamento
              </DropdownMenuItem>
            ) : null}
            {canReopenArt ? (
              <DropdownMenuItem onSelect={() => onReopen(ApprovalStage.Art)}>
                <RotateCcw aria-hidden="true" />
                Reabrir artes
              </DropdownMenuItem>
            ) : null}
            {canPublish ? (
              <DropdownMenuItem disabled={!canMarkPublished} onSelect={onPublish}>
                <Send aria-hidden="true" />
                {canMarkPublished
                  ? "Marcar como publicado"
                  : "Marcar como publicado (registre todos os canais)"}
              </DropdownMenuItem>
            ) : null}
            {canDuplicate ? (
              <DropdownMenuItem onSelect={onDuplicate}>
                <Copy aria-hidden="true" />
                Duplicar
              </DropdownMenuItem>
            ) : null}
            {canCancel ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={onCancel}
              >
                <Ban aria-hidden="true" />
                Cancelar conteúdo
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
