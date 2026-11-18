import { ArrowLeftRight, RotateCcw } from "lucide-react";
import { FormColorPicker } from "lost-ui/forms/form-color-picker";
import { Popover, PopoverContent, PopoverTrigger } from "lost-ui/ui/popover";
import { IconButton } from "@/components/shared/admin/icon-button";
import type { DesignColors } from "@/hooks/shared/design/use-design-colors";
import { normalizeColor } from "@/lib/shared/design/document";

function ColorChip({
  label,
  color,
  swatches,
  className,
  onChange,
}: {
  label: string;
  color: string | null;
  swatches: string[];
  className: string;
  onChange: (color: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${color ?? "indisponível"}`}
          title={label}
          disabled={color === null}
          className={`absolute flex size-11 items-center justify-center ${className}`}
        >
          <span
            className="size-7 rounded border-2 border-border"
            style={color === null ? undefined : { backgroundColor: color }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-64">
        <FormColorPicker
          name={label}
          label={label}
          value={color ?? ""}
          swatches={swatches}
          onValueChange={(value) => {
            const next = normalizeColor(value);
            if (next !== null) onChange(next);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function DesignColorChips({
  colors,
  swatches,
}: {
  colors: DesignColors;
  swatches: string[];
}) {
  return (
    <div className="mt-auto flex flex-col items-center gap-1 pt-2">
      <div className="relative size-16">
        <ColorChip
          label="Cor de fundo"
          color={colors.background}
          swatches={swatches}
          className="bottom-0 right-0"
          onChange={colors.setBackground}
        />
        <ColorChip
          label="Cor de frente"
          color={colors.foreground}
          swatches={swatches}
          className="left-0 top-0 z-10"
          onChange={colors.setForeground}
        />
      </div>
      <div className="flex">
        <IconButton label="Trocar cores (X)" icon={ArrowLeftRight} onClick={colors.swap} />
        <IconButton label="Cores padrão (D)" icon={RotateCcw} onClick={colors.reset} />
      </div>
    </div>
  );
}
