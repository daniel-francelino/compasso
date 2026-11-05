import { Modal } from "lost-ui/elements/modal";
import { DimensionRow, Stars } from "@/components/marketing/feedback/feedback-card";
import type { FeedbackCard } from "@/lib/marketing/feedback/feedback.functions";
import { FEEDBACK_SCORE_MAX } from "@/lib/shared/feedback/limits";
import { periodLabel } from "@/lib/shared/feedback/period";
import { feedbackQuestionLabels, feedbackScoreWord } from "@/lib/shared/feedback/questions";
import { FeedbackQuestion } from "@/lib/shared/feedback/types";
import { formatInZone } from "@/lib/shared/format";

const order = [
  FeedbackQuestion.Overall,
  FeedbackQuestion.Quality,
  FeedbackQuestion.Communication,
  FeedbackQuestion.Deadlines,
  FeedbackQuestion.Results,
] as const;

export function FeedbackDetailSheet({
  card,
  onClose,
}: {
  card: FeedbackCard | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={card !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      side="right"
      scrollable
      title={card ? `${card.brandName} · ${periodLabel(card.periodMonth)}` : ""}
      description={card ? `Resposta de ${card.respondentName}` : ""}
    >
      {card ? (
        <div className="space-y-5">
          {card.scores.overall !== null ? (
            <div className="flex items-center gap-3">
              <Stars score={card.scores.overall} />
              <span className="font-medium">
                {card.scores.overall} de {FEEDBACK_SCORE_MAX}
              </span>
              <span className="text-sm text-muted-foreground">
                {feedbackScoreWord(card.scores.overall)}
              </span>
            </div>
          ) : null}
          <ul className="space-y-2" aria-label="Notas por assunto">
            {order.map((key) => (
              <DimensionRow
                key={key}
                label={feedbackQuestionLabels[key]}
                score={card.scores[key]}
              />
            ))}
          </ul>
          <section className="space-y-1">
            <h4 className="font-medium">O que mais gostou</h4>
            <p className="whitespace-pre-wrap text-sm">{card.highlight ?? "Não comentou."}</p>
          </section>
          <section className="space-y-1">
            <h4 className="font-medium">O que pode melhorar</h4>
            <p className="whitespace-pre-wrap text-sm">{card.improvement ?? "Não comentou."}</p>
          </section>
          {card.answeredAt !== null && card.timezone !== null ? (
            <p className="text-sm text-muted-foreground">
              Respondido em {formatInZone(card.answeredAt, card.timezone)} (
              {card.timezone.replaceAll("_", " ")})
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
