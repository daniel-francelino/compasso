import { Heart, MessageCircle, PencilLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { Button } from "@/components/shared/ui/button";
import type { DecisionDraft } from "@/hooks/portal/use-decision-draft";
import { useFeedDecision } from "@/hooks/portal/use-feed-decision";
import { useTransientFlag } from "@/hooks/shared/use-transient-flag";
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
  const [popping, pop] = useTransientFlag(450);
  const [nudging, nudge] = useTransientFlag(350);
  const [wiggling, wiggle] = useTransientFlag(450);
  const wasApproved = useRef(approved);

  useEffect(() => {
    if (approved && !wasApproved.current) pop();
    wasApproved.current = approved;
  }, [approved, pop]);

  function askChanges() {
    const text = draft.text.trim();
    if (text.length < MIN_CHANGE_COMMENT) {
      onNeedText();
      return;
    }
    wiggle();
    void decision.decide(ApprovalOutcome.ChangesRequested, text);
  }

  return (
    <div className="space-y-1 px-1">
      <div
        className="flex flex-nowrap items-center gap-1"
        role="toolbar"
        aria-label="Ações do conteúdo"
      >
        {canDecide || approved ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 gap-1.5 px-2 transition-transform active:scale-90 [&_svg]:size-6 disabled:opacity-100"
            aria-pressed={approved}
            disabled={!canDecide || decision.busy}
            onClick={() => setConfirming(true)}
          >
            <Heart
              className={cn(approved && "fill-current text-violet", popping && "animate-heart-pop")}
              aria-hidden="true"
            />
            {approved ? "Aprovado" : "Aprovar"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 gap-1.5 px-2 transition-transform active:scale-90 [&_svg]:size-6"
          aria-label={`Comentários (${request.commentCount})`}
          onClick={() => {
            nudge();
            onToggleComments();
          }}
        >
          <MessageCircle aria-hidden="true" className={cn(nudging && "animate-bubble-nudge")} />
          {request.commentCount}
        </Button>
        {canDecide ? (
          <Button
            aria-label="Solicitar alteração"
            title="Solicitar alteração"
            type="button"
            variant="ghost"
            className="min-h-11 gap-1.5 px-2 transition-transform active:scale-90 [&_svg]:size-6"
            disabled={decision.busy}
            onClick={askChanges}
          >
            <PencilLine aria-hidden="true" className={cn(wiggling && "animate-pencil-wiggle")} />
            Alterar
          </Button>
        ) : null}
      </div>
      {approved && request.decidedByName ? (
        <p className="px-1 text-xs text-muted-foreground">Aprovado por {request.decidedByName}</p>
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
