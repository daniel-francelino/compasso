import { useCallback, useState } from "react";
import { z } from "zod";
import { FeedbackQuestion } from "@/lib/shared/feedback/types";
import { readStored, StoredKey, writeStored } from "@/lib/shared/stored-keys";

export type FeedbackDraft = {
  scores: Record<FeedbackQuestion, number>;
  skipped: FeedbackQuestion[];
  highlight: string;
  improvement: string;
};

const emptyFeedbackDraft: FeedbackDraft = {
  scores: {
    [FeedbackQuestion.Overall]: 0,
    [FeedbackQuestion.Quality]: 0,
    [FeedbackQuestion.Communication]: 0,
    [FeedbackQuestion.Deadlines]: 0,
    [FeedbackQuestion.Results]: 0,
  },
  skipped: [],
  highlight: "",
  improvement: "",
};

const draftSchema = z.object({
  scores: z.object({
    [FeedbackQuestion.Overall]: z.number(),
    [FeedbackQuestion.Quality]: z.number(),
    [FeedbackQuestion.Communication]: z.number(),
    [FeedbackQuestion.Deadlines]: z.number(),
    [FeedbackQuestion.Results]: z.number(),
  }),
  skipped: z.array(z.nativeEnum(FeedbackQuestion)),
  highlight: z.string(),
  improvement: z.string(),
});

const storeSchema = z.record(z.string(), draftSchema);

const draftKey = (brandId: string, period: string) => `${brandId}:${period}`;

export const useFeedbackDraft = (brandId: string, period: string) => {
  const [draft, setDraftState] = useState<FeedbackDraft>(
    () =>
      readStored(StoredKey.FeedbackDraft, storeSchema, {})[draftKey(brandId, period)] ??
      emptyFeedbackDraft,
  );

  const setDraft = useCallback(
    (next: FeedbackDraft) => {
      setDraftState(next);
      const stored = readStored(StoredKey.FeedbackDraft, storeSchema, {});
      writeStored(StoredKey.FeedbackDraft, { ...stored, [draftKey(brandId, period)]: next });
    },
    [brandId, period],
  );

  const clearDraft = useCallback(() => {
    const { [draftKey(brandId, period)]: _removed, ...rest } = readStored(
      StoredKey.FeedbackDraft,
      storeSchema,
      {},
    );
    writeStored(StoredKey.FeedbackDraft, Object.keys(rest).length === 0 ? null : rest);
  }, [brandId, period]);

  return { draft, setDraft, clearDraft };
};
