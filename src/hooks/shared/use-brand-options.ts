import { useQuery } from "@tanstack/react-query";
import { listBrandOptions } from "@/lib/shared/brands/brand-options.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export const useBrandOptions = (enabled = true) =>
  useQuery({
    queryKey: QueryKey.Brands.options(),
    queryFn: async () => unwrapResult(await listBrandOptions()).brands,
    enabled,
  });
