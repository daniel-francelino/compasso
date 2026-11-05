import { CircleCheck, Hourglass, Star, TriangleAlert, UserX } from "lucide-react";
import { BrandAvatar } from "@/components/shared/admin/brand-avatar";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import { Button } from "@/components/shared/ui/button";
import type { FeedbackCard as FeedbackCardData } from "@/lib/marketing/feedback/feedback.functions";
import { FEEDBACK_SCORE_MAX } from "@/lib/shared/feedback/limits";
import { periodLabel } from "@/lib/shared/feedback/period";
import { feedbackQuestionLabels } from "@/lib/shared/feedback/questions";
import { feedbackScoreTone, feedbackToneLabels } from "@/lib/shared/feedback/score-tone";
import {
  FeedbackCardState,
  FeedbackQuestion,
  FeedbackScoreTone,
} from "@/lib/shared/feedback/types";
import { formatDateTime, formatInZone } from "@/lib/shared/format";
import { cn } from "@/lib/shared/utils";

const dimensions = [
  FeedbackQuestion.Quality,
  FeedbackQuestion.Communication,
  FeedbackQuestion.Deadlines,
  FeedbackQuestion.Results,
] as const;

const toneStyle: Record<FeedbackScoreTone, { tone: StatusTone; icon: typeof CircleCheck }> = {
  [FeedbackScoreTone.Attention]: { tone: "negative", icon: TriangleAlert },
  [FeedbackScoreTone.Neutral]: { tone: "neutral", icon: CircleCheck },
  [FeedbackScoreTone.Positive]: { tone: "success", icon: CircleCheck },
};

export function Stars({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: FEEDBACK_SCORE_MAX }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "size-4",
            index < score ? "fill-current text-foreground" : "text-muted-foreground/50",
          )}
        />
      ))}
    </span>
  );
}

export function DimensionRow({ label, score }: { label: string; score: number | null }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      {score === null ? (
        <span className="text-muted-foreground">Não avaliou</span>
      ) : (
        <>
          <span
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${score} de ${FEEDBACK_SCORE_MAX}`}
          >
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(score / FEEDBACK_SCORE_MAX) * 100}%` }}
            />
          </span>
          <span className="w-6 text-right font-medium">{score}</span>
        </>
      )}
    </li>
  );
}

const pendingText = (card: FeedbackCardData): string => {
  if (card.state === FeedbackCardState.Declined) return "Dispensou este mês";
  if (card.state === FeedbackCardState.Snoozed) {
    return `Adiou ${card.snoozeCount} ${card.snoozeCount === 1 ? "vez" : "vezes"}`;
  }
  return "Ainda não abriu a pesquisa";
};

export function FeedbackCard({
  card,
  logoUrl,
  onOpen,
}: {
  card: FeedbackCardData;
  logoUrl: string | null;
  onOpen: (card: FeedbackCardData) => void;
}) {
  const overall = card.scores.overall;
  const answered = card.state === FeedbackCardState.Answered && overall !== null;
  const tone = answered ? toneStyle[feedbackScoreTone(overall)] : null;

  return (
    <SectionCard as="article" padding="sm" className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <BrandAvatar name={card.brandName} logoUrl={logoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{card.brandName}</h3>
          <p className="truncate text-sm text-muted-foreground">{card.clientName}</p>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {periodLabel(card.periodMonth)}
        </span>
      </header>

      {answered && tone !== null ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Stars score={overall} />
            <span className="font-medium">
              {overall} de {FEEDBACK_SCORE_MAX}
            </span>
            <StatusBadge tone={tone.tone} icon={tone.icon}>
              {feedbackToneLabels[feedbackScoreTone(overall)]}
            </StatusBadge>
          </div>
          <ul className="space-y-1.5" aria-label="Notas por assunto">
            {dimensions.map((key) => (
              <DimensionRow
                key={key}
                label={feedbackQuestionLabels[key]}
                score={card.scores[key]}
              />
            ))}
          </ul>
          <div className="space-y-2 text-sm">
            {card.highlight ? (
              <p className="line-clamp-3">
                <span className="font-medium">Gostou: </span>
                {card.highlight}
              </p>
            ) : null}
            {card.improvement ? (
              <p className="line-clamp-3">
                <span className="font-medium">Melhorar: </span>
                {card.improvement}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          {card.state === FeedbackCardState.Declined ? (
            <UserX className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Hourglass className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
          <span>{pendingText(card)}</span>
        </div>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {card.respondentName}
          {card.answeredAt !== null && card.timezone !== null
            ? ` · ${formatInZone(card.answeredAt, card.timezone)} (${card.timezone.replaceAll("_", " ")})`
            : card.lastInteractionAt !== null
              ? ` · último contato em ${formatDateTime(card.lastInteractionAt)}`
              : ""}
        </span>
        {answered ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onOpen(card)}>
            Ver detalhes
          </Button>
        ) : null}
      </footer>
    </SectionCard>
  );
}
