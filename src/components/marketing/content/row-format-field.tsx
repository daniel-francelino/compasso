import { SelectField } from "@/components/shared/admin/form-fields";
import { formatIcons } from "@/components/shared/content/format-icons";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { platformFormats } from "@/lib/shared/editorial/editorial";
import { contentFormatLabels } from "@/lib/shared/labels";

export function RowFormatField({
  id,
  label = "Formato",
  platform,
  value,
  disabled,
  error,
  onChange,
}: {
  id: string;
  label?: string;
  platform: Platform | undefined;
  value: ContentFormat;
  disabled: boolean;
  error?: string | undefined;
  onChange: (format: ContentFormat) => void;
}) {
  const formats = platform ? platformFormats[platform] : [];
  return (
    <SelectField
      id={id}
      label={label}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        const match = formats.find((format) => format === next);
        if (match) onChange(match);
      }}
      options={formats.map((format) => {
        const Icon = formatIcons[format];
        return {
          value: format,
          label: contentFormatLabels[format],
          icon: <Icon aria-hidden="true" className="size-4" />,
        };
      })}
      error={error}
    />
  );
}
