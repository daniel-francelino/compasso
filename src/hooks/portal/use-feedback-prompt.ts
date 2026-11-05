import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPortalFeedbackPrompt } from "@/lib/portal/feedback/feedback.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const PROMPT_STALE_MS = 5 * 60_000;

export const useFeedbackPrompt = (brandId: string) => {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QueryKey.Portal.feedbackPrompt(brandId),
    queryFn: async () => unwrapResult(await getPortalFeedbackPrompt({ data: { brandId } })).prompt,
    enabled: can(auth, Action.Feedback.Answer),
    staleTime: PROMPT_STALE_MS,
    retry: false,
  });
  return {
    prompt: query.data ?? null,
    refresh: () =>
      queryClient.invalidateQueries({ queryKey: QueryKey.Portal.feedbackPrompt(brandId) }),
  };
};
