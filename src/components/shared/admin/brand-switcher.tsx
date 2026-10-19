import { useNavigate, useParams } from "@tanstack/react-router";
import { brandSelectOptions } from "@/components/shared/admin/brand-select-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/ui/select";
import { useBrandOptions } from "@/hooks/shared/use-brand-options";
import { AppRoute } from "@/lib/shared/routes";

const ALL_BRANDS = "all";

export function BrandSwitcher() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const current = params.brandId ?? ALL_BRANDS;
  const query = useBrandOptions();

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
      <SelectTrigger aria-label="Marca atual" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {brandSelectOptions(query.data, "Todas as marcas", ALL_BRANDS).map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {"icon" in option ? (
              <span className="flex items-center gap-2">
                {option.icon}
                {option.label}
              </span>
            ) : (
              option.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
