import { FEEDBACK_ATTENTION_SCORE } from "@/lib/shared/feedback/limits";
import { FeedbackScoreTone } from "@/lib/shared/feedback/types";

export const feedbackScoreTone = (score: number): FeedbackScoreTone => {
  if (score <= FEEDBACK_ATTENTION_SCORE) return FeedbackScoreTone.Attention;
  if (score === 3) return FeedbackScoreTone.Neutral;
  return FeedbackScoreTone.Positive;
};

export const feedbackToneLabels: Record<FeedbackScoreTone, string> = {
  [FeedbackScoreTone.Attention]: "Precisa de atenção",
  [FeedbackScoreTone.Neutral]: "Dentro do esperado",
  [FeedbackScoreTone.Positive]: "Positivo",
};
