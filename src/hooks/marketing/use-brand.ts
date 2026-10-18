import { useQuery } from "@tanstack/react-query";
import { getBrand } from "@/lib/marketing/brands/brands.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export const useBrand = (brandId: string) =>
  useQuery({
    queryKey: QueryKey.Brands.detail(brandId),
    queryFn: async () => unwrapResult(await getBrand({ data: { id: brandId } })).brand,
  });
