import { useQuery } from "@tanstack/react-query";
import { signPortalMedia } from "@/lib/portal/approvals/portal.functions";
import type { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const STALE_MS = 60_000;

export const usePortalUrls = (
  revisionId: string,
  versionIds: readonly string[],
  variant: MediaVariant,
) =>
  useQuery({
    queryKey: QueryKey.Portal.urls(revisionId, variant, versionIds),
    queryFn: async () =>
      unwrapResult(
        await signPortalMedia({ data: { revisionId, versionIds: [...versionIds], variant } }),
      ).urls,
    enabled: versionIds.length > 0,
    staleTime: STALE_MS,
  });
