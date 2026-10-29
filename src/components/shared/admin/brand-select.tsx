import { brandSelectOptions } from "@/components/shared/admin/brand-select-options";
import { SelectField } from "@/components/shared/admin/form-fields";
import type { BrandOption } from "@/lib/shared/brands/brand-options.functions";

export function BrandSelect({
  id,
  label = "Marca",
  value,
  onValueChange,
  brands,
  allLabel,
  allValue,
  required,
  error,
  disabled,
  placeholder,
  hideLabel,
  triggerClassName,
}: {
  id: string;
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  brands: BrandOption[] | undefined;
  allLabel?: string;
  allValue?: string;
  required?: boolean;
  error?: string | undefined;
  disabled?: boolean;
  placeholder?: string;
  hideLabel?: boolean;
  triggerClassName?: string;
}) {
  return (
    <SelectField
      id={id}
      label={label}
      value={value}
      onValueChange={onValueChange}
      emptyText={brands?.length === 0 ? "Nenhuma marca cadastrada" : undefined}
      options={brandSelectOptions(brands, allLabel, allValue)}
      {...(required === undefined ? {} : { required })}
      {...(error === undefined ? {} : { error })}
      {...(disabled === undefined ? {} : { disabled })}
      {...(placeholder === undefined ? {} : { placeholder })}
      {...(hideLabel === undefined ? {} : { hideLabel })}
      {...(triggerClassName === undefined ? {} : { triggerClassName })}
    />
  );
}
