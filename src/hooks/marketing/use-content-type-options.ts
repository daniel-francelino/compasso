import { useQuery } from "@tanstack/react-query";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import {
  type ContentTypeRow,
  listContentTypes,
} from "@/lib/shared/content-types/content-types.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export const useContentTypeOptions = (linked: ContentTypeRow[]): ContentTypeRow[] => {
  const auth = useAuth();
  const query = useQuery({
    queryKey: QueryKey.Content.types(),
    queryFn: async () => unwrapResult(await listContentTypes()).types,
    enabled: can(auth, Action.Content.View),
  });
  const active = query.data ?? [];
  return [
    ...active,
    ...linked.filter((type) => type.archived && !active.some((entry) => entry.id === type.id)),
  ];
};
