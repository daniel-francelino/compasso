import { describe, expect, it } from "vitest";
import {
  periodFromParam,
  periodLabel,
  periodMonthName,
  periodToParam,
  previousClosedMonth,
  shiftPeriod,
} from "@/lib/shared/feedback/period";
import {
  feedbackQuestions,
  feedbackScoreWord,
  questionText,
} from "@/lib/shared/feedback/questions";
import { feedbackAnswersSchema } from "@/lib/shared/feedback/schemas";
import { feedbackScoreTone } from "@/lib/shared/feedback/score-tone";
import { FeedbackScoreTone } from "@/lib/shared/feedback/types";

const valid = {
  overall: 4,
  quality: 5,
  communication: null,
  deadlines: 3,
  results: null,
  highlight: " Gostei ",
  improvement: "",
};

describe("feedbackScoreTone", () => {
  it("marks one and two as needing attention", () => {
    expect(feedbackScoreTone(1)).toBe(FeedbackScoreTone.Attention);
    expect(feedbackScoreTone(2)).toBe(FeedbackScoreTone.Attention);
  });

  it("keeps three neutral and four or five positive", () => {
    expect(feedbackScoreTone(3)).toBe(FeedbackScoreTone.Neutral);
    expect(feedbackScoreTone(4)).toBe(FeedbackScoreTone.Positive);
    expect(feedbackScoreTone(5)).toBe(FeedbackScoreTone.Positive);
  });
});

describe("feedback questions", () => {
  it("requires only the overall question", () => {
    expect(feedbackQuestions.filter((question) => question.required)).toHaveLength(1);
    expect(feedbackQuestions[0]?.key).toBe("overall");
  });

  it("puts the month in the overall question", () => {
    const [overall] = feedbackQuestions;
    expect(overall && questionText(overall, "outubro")).toBe(
      "Como você avalia o trabalho de outubro?",
    );
  });

  it("names every score and nothing for a missing one", () => {
    expect([1, 2, 3, 4, 5].every((score) => feedbackScoreWord(score) !== "")).toBe(true);
    expect(feedbackScoreWord(null)).toBe("");
    expect(feedbackScoreWord(6)).toBe("");
  });
});

describe("feedback period", () => {
  it("reads a month from the URL and refuses anything else", () => {
    expect(periodFromParam("2026-10")).toBe("2026-10-01");
    expect(periodFromParam("2026-13")).toBeNull();
    expect(periodFromParam("2026-10-01")).toBeNull();
    expect(periodFromParam(undefined)).toBeNull();
  });

  it("writes the month back to the URL", () => {
    expect(periodToParam("2026-10-01")).toBe("2026-10");
  });

  it("finds the latest closed month, also across a year", () => {
    expect(previousClosedMonth("2026-11-05")).toBe("2026-10-01");
    expect(previousClosedMonth("2027-01-15")).toBe("2026-12-01");
  });

  it("moves between months", () => {
    expect(shiftPeriod("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftPeriod("2026-10-01", 1)).toBe("2026-11-01");
  });

  it("names the month for the questions and the cards", () => {
    expect(periodMonthName("2026-10-01")).toBe("outubro");
    expect(periodLabel("2026-10-01")).toBe("Outubro de 2026");
  });
});

describe("feedbackAnswersSchema", () => {
  it("accepts skipped dimensions and trims the comments", () => {
    const parsed = feedbackAnswersSchema.parse(valid);
    expect(parsed.communication).toBeNull();
    expect(parsed.highlight).toBe("Gostei");
  });

  it("requires the overall score between one and five", () => {
    expect(feedbackAnswersSchema.safeParse({ ...valid, overall: 0 }).success).toBe(false);
    expect(feedbackAnswersSchema.safeParse({ ...valid, overall: 6 }).success).toBe(false);
    expect(feedbackAnswersSchema.safeParse({ ...valid, overall: null }).success).toBe(false);
  });

  it("refuses a comment above the limit", () => {
    expect(
      feedbackAnswersSchema.safeParse({ ...valid, improvement: "a".repeat(1001) }).success,
    ).toBe(false);
  });
});
