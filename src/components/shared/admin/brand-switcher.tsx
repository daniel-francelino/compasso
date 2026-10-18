import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/ui/select";
import { listBrandOptions } from "@/lib/shared/brands/brand-options.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const ALL_BRANDS = "all";

export function BrandSwitcher() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const current = params.brandId ?? ALL_BRANDS;

  const query = useQuery({
    queryKey: QueryKey.Brands.options(),
    queryFn: async () => unwrapResult(await listBrandOptions()).brands,
  });

  if (query.data === undefined || query.data.length === 0) return null;

  return (
    <Select
      value={current}
      onValueChange={(value) => {
        if (value === ALL_BRANDS) {
          void navigate({ to: AppRoute.Brands });
          return;
        }
        void navigate({ to: "/admin/marketing/brands/$brandId", params: { brandId: value } });
      }}
    >
      <SelectTrigger aria-label="Marca atual" className="h-11 w-44 md:h-10 md:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_BRANDS}>Todas as marcas</SelectItem>
        {query.data.map((brand) => (
          <SelectItem key={brand.id} value={brand.id}>
            {brand.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
