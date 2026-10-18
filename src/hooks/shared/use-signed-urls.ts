import { useQuery } from "@tanstack/react-query";
import { signMediaUrls } from "@/lib/shared/media/media.functions";
import type { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const STALE_MS = 4 * 60_000;

export const useSignedUrls = (versionIds: readonly string[], variant: MediaVariant) => {
  const ids = [...new Set(versionIds)].sort();
  return useQuery({
    queryKey: QueryKey.Media.signed(ids, variant),
    queryFn: async () =>
      unwrapResult(await signMediaUrls({ data: { versionIds: ids, variant } })).urls,
    enabled: ids.length > 0,
    staleTime: STALE_MS,
  });
};
