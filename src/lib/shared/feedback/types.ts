import type { ValueOf } from "@/lib/shared/utils";

export const FeedbackQuestion = {
  Overall: "overall",
  Quality: "quality",
  Communication: "communication",
  Deadlines: "deadlines",
  Results: "results",
} as const;
export type FeedbackQuestion = ValueOf<typeof FeedbackQuestion>;

export const FeedbackPromptState = {
  None: "none",
  Due: "due",
  Banner: "banner",
} as const;
export type FeedbackPromptState = ValueOf<typeof FeedbackPromptState>;

export const FeedbackListStatus = {
  Answered: "answered",
  Pending: "pending",
} as const;
export type FeedbackListStatus = ValueOf<typeof FeedbackListStatus>;

export const FeedbackCardState = {
  Answered: "answered",
  NotOpened: "not_opened",
  Snoozed: "snoozed",
  Declined: "declined",
} as const;
export type FeedbackCardState = ValueOf<typeof FeedbackCardState>;

export const FeedbackScoreTone = {
  Attention: "attention",
  Neutral: "neutral",
  Positive: "positive",
} as const;
export type FeedbackScoreTone = ValueOf<typeof FeedbackScoreTone>;
