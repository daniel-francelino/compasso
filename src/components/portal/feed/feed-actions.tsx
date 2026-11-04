import { Heart, MessageCircle, PencilLine } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { Button } from "@/components/shared/ui/button";
import type { DecisionDraft } from "@/hooks/portal/use-decision-draft";
import { useFeedDecision } from "@/hooks/portal/use-feed-decision";
import { MIN_CHANGE_COMMENT } from "@/lib/portal/approvals/schemas";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { ApprovalOutcome, ApprovalRequestStatus, ApprovalStage } from "@/lib/shared/enums";
import { cn } from "@/lib/shared/utils";

export function FeedActions({
  request,
  draft,
  onToggleComments,
  onNeedText,
}: {
  request: PortalRequest;
  draft: DecisionDraft;
  onToggleComments: () => void;
  onNeedText: () => void;
}) {
  const decision = useFeedDecision(request.id, draft.clear);
  const [confirming, setConfirming] = useState(false);
  const pending = request.status === ApprovalRequestStatus.Pending;
  const canDecide = pending && request.canDecide;
  const approved = request.status === ApprovalRequestStatus.Approved;
  const plan = request.stage === ApprovalStage.Plan;

  function askChanges() {
    const text = draft.text.trim();
    if (text.length < MIN_CHANGE_COMMENT) {
      onNeedText();
      return;
    }
    void decision.decide(ApprovalOutcome.ChangesRequested, text);
  }

  return (
    <div className="space-y-1 px-2">
      <div
        className="flex flex-wrap items-center justify-between gap-2"
        role="toolbar"
        aria-label="Ações do conteúdo"
      >
        <div className="flex items-center gap-1">
          {canDecide || approved ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 gap-2 disabled:opacity-100"
              aria-pressed={approved}
              disabled={!canDecide || decision.busy}
              onClick={() => setConfirming(true)}
            >
              <Heart
                className={cn("size-6", approved && "fill-current text-violet")}
                aria-hidden="true"
              />
              {approved ? "Aprovado" : "Aprovar"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 gap-2"
            aria-label={`Comentários (${request.commentCount})`}
            onClick={onToggleComments}
          >
            <MessageCircle className="size-6" aria-hidden="true" />
            {request.commentCount}
          </Button>
        </div>
        {canDecide ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={decision.busy}
            onClick={askChanges}
          >
            <PencilLine aria-hidden="true" />
            Solicitar alteração
          </Button>
        ) : null}
      </div>
      {approved && request.decidedByName ? (
        <p className="px-1 text-xs text-muted-foreground">Aprovado por {request.decidedByName}</p>
      ) : null}
      {approved && request.decidedOnBehalf ? (
        <p className="px-1 text-xs text-muted-foreground">Aprovado pela equipe</p>
      ) : null}
      {pending && !request.canDecide ? (
        <p className="px-1 text-xs text-muted-foreground">
          Você pode comentar, mas a decisão é de quem aprova a marca.
        </p>
      ) : null}
      {decision.error ? (
        <p role="alert" className="px-1 text-xs text-destructive">
          {decision.error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={plan ? "Aprovar este planejamento?" : "Aprovar esta versão?"}
        description={
          <p>
            {plan
              ? "Você aprova o planejamento. A produção segue e você receberá a arte para aprovar depois."
              : "A equipe será avisada de que você aprovou exatamente o conteúdo enviado. A decisão não pode ser desfeita por você."}
          </p>
        }
        confirmLabel="Aprovar"
        busy={decision.busy}
        onConfirm={() => decision.decide(ApprovalOutcome.Approved, "")}
      />
    </div>
  );
}
