import {
  Ban,
  ClipboardList,
  Copy,
  Hammer,
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
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import {
  DirectMoves,
  approvableStatuses,
  reopenableStatuses,
  submittableStatuses,
} from "@/lib/shared/editorial/editorial";
import { EditorialStatus } from "@/lib/shared/enums";

const MOVE_LABELS: Partial<Record<EditorialStatus, { label: string; icon: LucideIcon }>> = {
  [EditorialStatus.Planning]: { label: "Voltar para planejamento", icon: ClipboardList },
  [EditorialStatus.InProduction]: { label: "Iniciar produção", icon: Hammer },
};

const moveLabel = (from: EditorialStatus, to: EditorialStatus) => {
  if (from === EditorialStatus.ChangesRequested && to === EditorialStatus.InProduction) {
    return { label: "Retomar produção", icon: Undo2 };
  }
  return MOVE_LABELS[to];
};

const submitLabel = (status: EditorialStatus): string =>
  status === EditorialStatus.AwaitingApproval ? "Reenviar para aprovação" : "Enviar para aprovação";

const movesOf = (status: EditorialStatus, artApproved: boolean): readonly EditorialStatus[] => {
  if (status === EditorialStatus.Approved) {
    return artApproved ? [] : [EditorialStatus.InProduction, EditorialStatus.Planning];
  }
  return DirectMoves[status];
};

export function ContentSaveButton({
  isNew,
  editable,
  dirty,
  saving,
}: {
  isNew: boolean;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
}) {
  if (!editable) return null;
  return (
    <Button type="submit" size="sm" loading={saving} disabled={saving || (!isNew && !dirty)}>
      <Save aria-hidden="true" />
      Salvar conteúdo
    </Button>
  );
}

export function ContentActions({
  status,
  artApproved,
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
  hideSave = false,
}: {
  status: EditorialStatus;
  artApproved: boolean;
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
  onApproveOnBehalf: () => void;
  onReopen: () => void;
  onCancel: () => void;
  onDuplicate: () => void;
  onPublish: () => void;
  canMarkPublished: boolean;
  hideSave?: boolean;
}) {
  const auth = useAuth();
  const moves =
    hasContent && can(auth, Action.Content.Update) && !cancelled
      ? movesOf(status, artApproved)
      : [];
  const canSubmit =
    hasContent &&
    can(auth, Action.Content.Submit) &&
    !cancelled &&
    submittableStatuses.includes(status);
  const canApprove =
    hasContent &&
    can(auth, Action.Approvals.Override) &&
    !cancelled &&
    approvableStatuses.includes(status);
  const reopenAllowed = can(auth, Action.Content.Reopen) && !cancelled && !hasPublished;
  const canReopen = reopenAllowed && reopenableStatuses.includes(status);
  const canPublish =
    hasContent &&
    can(auth, Action.Content.PublishManual) &&
    !cancelled &&
    status === EditorialStatus.Approved;
  const canCancel = hasContent && can(auth, Action.Content.Cancel) && !cancelled;
  const canDuplicate = hasContent && can(auth, Action.Content.Create);

  const [primaryMove, ...otherMoves] = moves;
  const hasMenu =
    otherMoves.length > 0 || canApprove || canReopen || canPublish || canDuplicate || canCancel;
  const approveLabel = "Aprovar pelo cliente";
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
      {hideSave ? null : (
        <ContentSaveButton isNew={isNew} editable={editable} dirty={dirty} saving={saving} />
      )}
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
            {canApprove ? (
              <DropdownMenuItem disabled={dirty} onSelect={onApproveOnBehalf}>
                <UserCheck aria-hidden="true" />
                {dirty ? `${approveLabel} (salve antes)` : approveLabel}
              </DropdownMenuItem>
            ) : null}
            {canReopen ? (
              <DropdownMenuItem onSelect={onReopen}>
                <RotateCcw aria-hidden="true" />
                Reabrir para produção
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
