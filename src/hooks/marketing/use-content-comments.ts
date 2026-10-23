import { useQuery } from "@tanstack/react-query";
import { listComments } from "@/lib/marketing/content/comments.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export const useContentComments = (itemId: string) =>
  useQuery({
    queryKey: QueryKey.Content.comments(itemId),
    queryFn: async () => unwrapResult(await listComments({ data: { itemId } })).comments,
  });
