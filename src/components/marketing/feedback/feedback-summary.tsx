import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { SectionCard } from "@/components/shared/admin/section-card";
import type { FeedbackSummary as FeedbackSummaryData } from "@/lib/marketing/feedback/feedback.functions";
import { FEEDBACK_SCORE_MAX } from "@/lib/shared/feedback/limits";
import { feedbackQuestionLabels } from "@/lib/shared/feedback/questions";
import { FeedbackQuestion } from "@/lib/shared/feedback/types";
import { formatNumber, formatPercent } from "@/lib/shared/format";

const NO_DATA = "Sem dados";

function Tile({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return (
    <SectionCard padding="sm" as="div">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
    </SectionCard>
  );
}

function ChangeNote({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return null;
  const delta = Math.round((current - previous) * 10) / 10;
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : ArrowRight;
  const word = delta > 0 ? "subiu" : delta < 0 ? "caiu" : "estável";
  return (
    <span className="flex items-center gap-1">
      <Icon className="size-3.5" aria-hidden="true" />
      {delta === 0
        ? "Estável"
        : `${word[0]?.toUpperCase()}${word.slice(1)} ${formatNumber(Math.abs(delta), 1)}`}{" "}
      em relação ao mês anterior
    </span>
  );
}

const dimensions = [
  { key: FeedbackQuestion.Quality, pick: (s: FeedbackSummaryData) => s.dimensions.quality },
  {
    key: FeedbackQuestion.Communication,
    pick: (s: FeedbackSummaryData) => s.dimensions.communication,
  },
  { key: FeedbackQuestion.Deadlines, pick: (s: FeedbackSummaryData) => s.dimensions.deadlines },
  { key: FeedbackQuestion.Results, pick: (s: FeedbackSummaryData) => s.dimensions.results },
] as const;

export function FeedbackSummary({ summary }: { summary: FeedbackSummaryData }) {
  const rate = summary.expected > 0 ? Math.min(summary.answered / summary.expected, 1) : null;
  return (
    <section aria-label="Resumo do mês" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Média geral"
          value={
            summary.averageOverall === null
              ? NO_DATA
              : `${formatNumber(summary.averageOverall, 1)} de ${FEEDBACK_SCORE_MAX}`
          }
          note={undefined}
        />
        <Tile
          label="Taxa de resposta"
          value={rate === null ? NO_DATA : formatPercent(rate)}
          note={rate === null ? undefined : `${summary.answered} de ${summary.expected} contatos`}
        />
        <Tile
          label="Pedem atenção"
          value={summary.answered === 0 ? NO_DATA : String(summary.attention)}
          note="Nota geral 1 ou 2"
        />
        <Tile
          label="Ainda sem resposta"
          value={summary.expected === 0 ? NO_DATA : String(summary.pending)}
          note="Incluem quem adiou ou dispensou"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        <ChangeNote current={summary.averageOverall} previous={summary.previousAverageOverall} />
      </p>
      <p className="text-sm text-muted-foreground">
        {dimensions
          .map(({ key, pick }) => {
            const value = pick(summary);
            return `${feedbackQuestionLabels[key]}: ${value === null ? NO_DATA : formatNumber(value, 1)}`;
          })
          .join(" · ")}
      </p>
    </section>
  );
}
