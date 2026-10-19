import { useQuery } from "@tanstack/react-query";
import { signPortalPreviewMedia } from "@/lib/portal/approvals/portal.functions";
import type { PortalRequest } from "@/lib/portal/approvals/types";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const STALE_MS = 60_000;

export const usePortalPreviewUrls = (requests: readonly PortalRequest[]) => {
  const sources = requests
    .filter((request) => request.media.length > 0)
    .map((request) => ({
      revisionId: request.revisionId,
      versionIds: request.media.map((item) => item.versionId),
    }));

  return useQuery({
    queryKey: QueryKey.Portal.previewUrls(sources),
    queryFn: async () => {
      const batches: Array<typeof sources> = [];
      for (let index = 0; index < sources.length; index += 50) {
        batches.push(sources.slice(index, index + 50));
      }
      const results = await Promise.all(
        batches.map(
          async (requests) =>
            unwrapResult(await signPortalPreviewMedia({ data: { requests } })).urls,
        ),
      );
      return Object.assign({}, ...results);
    },
    enabled: sources.length > 0,
    staleTime: STALE_MS,
  });
};
