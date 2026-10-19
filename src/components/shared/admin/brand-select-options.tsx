import { BrandAvatar } from "@/components/shared/admin/brand-avatar";
import type { BrandOption } from "@/lib/shared/brands/brand-options.functions";

export const brandSelectOptions = (
  brands: BrandOption[] | undefined,
  allLabel?: string,
  allValue = "all",
) => [
  ...(allLabel === undefined ? [] : [{ value: allValue, label: allLabel }]),
  ...(brands ?? []).map((brand) => ({
    value: brand.id,
    label: brand.name,
    icon: <BrandAvatar name={brand.name} logoUrl={brand.logoUrl} size="sm" />,
  })),
];
