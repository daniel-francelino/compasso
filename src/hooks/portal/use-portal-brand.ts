import { useQuery } from "@tanstack/react-query";
import { getPortalBrand } from "@/lib/portal/approvals/portal.functions";
import { PORTAL_URL_GC_MS, PORTAL_URL_STALE_MS } from "@/lib/shared/media/limits";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export const usePortalBrand = (brandId: string) =>
  useQuery({
    queryKey: QueryKey.Portal.brand(brandId),
    queryFn: async () => unwrapResult(await getPortalBrand({ data: { brandId } })).brand,
    staleTime: PORTAL_URL_STALE_MS,
    gcTime: PORTAL_URL_GC_MS,
    refetchInterval: PORTAL_URL_STALE_MS,
  });
