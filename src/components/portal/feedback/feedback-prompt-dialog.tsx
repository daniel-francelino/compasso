import { MessageSquareHeart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "lost-ui/elements/modal";
import { FeedbackForm } from "@/components/portal/feedback/feedback-form";
import { Button } from "@/components/shared/ui/button";
import { type FeedbackDraft, useFeedbackDraft } from "@/hooks/portal/use-feedback-draft";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import {
  declinePortalFeedback,
  submitPortalFeedback,
} from "@/lib/portal/feedback/feedback.functions";
import type { FeedbackAnswers } from "@/lib/shared/feedback/schemas";
import { periodMonthName } from "@/lib/shared/feedback/period";
import { FeedbackQuestion } from "@/lib/shared/feedback/types";

const FORM_ID = "portal-feedback-form";

const scoreOf = (draft: FeedbackDraft, key: FeedbackQuestion): number | null =>
  draft.skipped.includes(key) || draft.scores[key] === 0 ? null : draft.scores[key];

const answersOf = (draft: FeedbackDraft): FeedbackAnswers => ({
  overall: draft.scores[FeedbackQuestion.Overall],
  quality: scoreOf(draft, FeedbackQuestion.Quality),
  communication: scoreOf(draft, FeedbackQuestion.Communication),
  deadlines: scoreOf(draft, FeedbackQuestion.Deadlines),
  results: scoreOf(draft, FeedbackQuestion.Results),
  highlight: draft.highlight,
  improvement: draft.improvement,
});

export function FeedbackPromptDialog({
  brandId,
  period,
  open,
  onLater,
  onFinished,
}: {
  brandId: string;
  period: string;
  open: boolean;
  onLater: () => Promise<void>;
  onFinished: () => void;
}) {
  const { errors, error, busy, send } = useFormSubmit();
  const { draft, setDraft, clearDraft } = useFeedbackDraft(brandId, period);
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const monthName = periodMonthName(period);

  function handleSubmit() {
    void send(
      () =>
        submitPortalFeedback({
          data: { brandId, periodMonth: period, answers: answersOf(draft) },
        }),
      () => {
        clearDraft();
        toast.success("Obrigado! Sua avaliação foi enviada.");
        onFinished();
      },
    );
  }

  function handleDecline() {
    void send(
      () => declinePortalFeedback({ data: { brandId, periodMonth: period } }),
      () => {
        clearDraft();
        onFinished();
      },
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) void onLater();
      }}
      dismissible={!busy}
      scrollable
      title={
        <span className="flex items-center gap-2">
          <MessageSquareHeart className="size-5 text-muted-foreground" aria-hidden="true" />
          Como foi o trabalho em {monthName}?
        </span>
      }
      description="Leva cerca de dois minutos. Sua opinião ajuda a equipe a melhorar."
    >
      <FeedbackForm
        id={FORM_ID}
        monthName={monthName}
        draft={draft}
        onChange={setDraft}
        onSubmit={handleSubmit}
        errors={errors}
        error={error}
        footer={
          confirmingDecline ? (
            <div role="group" aria-label="Dispensar a pesquisa" className="space-y-3">
              <p className="text-sm">
                Dispensar a pesquisa de {monthName}? Você não será perguntado de novo neste mês.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmingDecline(false)}
                >
                  Voltar
                </Button>
                <Button type="button" loading={busy} onClick={handleDecline}>
                  Dispensar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={busy}>
                  Enviar respostas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void onLater()}
                >
                  Responder depois
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmingDecline(true)}
              >
                Agora não quero responder
              </Button>
            </div>
          )
        }
      />
    </Modal>
  );
}
