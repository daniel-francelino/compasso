import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { signPortalPreviewMedia } from "@/lib/portal/approvals/portal.functions";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { PORTAL_URL_GC_MS, PORTAL_URL_STALE_MS } from "@/lib/shared/media/limits";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const BATCH = 50;

export const usePortalPreviewUrls = (requests: readonly PortalRequest[]) => {
  const sources = requests
    .filter((request) => request.media.length > 0)
    .map((request) => ({
      revisionId: request.revisionId,
      versionIds: request.media.map((item) => item.versionId),
    }));

  const query = useQuery({
    queryKey: QueryKey.Portal.previewUrls(sources),
    queryFn: async () => {
      const batches: Array<typeof sources> = [];
      for (let index = 0; index < sources.length; index += BATCH) {
        batches.push(sources.slice(index, index + BATCH));
      }
      const results = await Promise.all(
        batches.map(
          async (batch) =>
            unwrapResult(await signPortalPreviewMedia({ data: { requests: batch } })).urls,
        ),
      );
      return Object.assign({}, ...results) as Record<string, string>;
    },
    enabled: sources.length > 0,
    staleTime: PORTAL_URL_STALE_MS,
    gcTime: PORTAL_URL_GC_MS,
  });
  const { refetch } = query;
  const refresh = useCallback(async () => (await refetch()).data, [refetch]);

  return { urls: query.data, refresh };
};
