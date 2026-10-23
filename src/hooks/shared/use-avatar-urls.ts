import { useQuery } from "@tanstack/react-query";
import { getAvatarUrls } from "@/lib/shared/auth/profile.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const STALE_MS = 4 * 60_000;
const NO_URLS: Record<string, string> = {};

export const useAvatarUrls = (ids: readonly (string | null | undefined)[]) => {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string"))].sort();
  const query = useQuery({
    queryKey: QueryKey.Avatars.urls(unique),
    queryFn: async () => unwrapResult(await getAvatarUrls({ data: { ids: unique } })).urls,
    enabled: unique.length > 0,
    staleTime: STALE_MS,
  });
  return query.data ?? NO_URLS;
};
