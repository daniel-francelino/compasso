import { DESIGN_BLEND_MODE_LABEL, DesignBlendMode } from "@/lib/shared/design/types";

export const BLEND_ITEMS = Object.values(DesignBlendMode).map((value) => ({
  value,
  label: DESIGN_BLEND_MODE_LABEL[value],
}));

export const asBlendMode = (value: string): DesignBlendMode | undefined =>
  BLEND_ITEMS.find((item) => item.value === value)?.value;
