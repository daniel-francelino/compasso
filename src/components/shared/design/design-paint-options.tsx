import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { FormSlider } from "lost-ui/forms/form-slider";
import type { ToolOptionsProps } from "@/components/shared/design/design-tool-options";
import { Button } from "@/components/shared/ui/button";
import {
  type BrushOptionKey,
  PAINT_LIMITS,
  PAINT_SAMPLE_LABEL,
  PaintSampleMode,
  isBrushTool,
} from "@/lib/shared/design/paint";
import { cn } from "@/lib/shared/utils";

const first = (value: number | number[]) => (Array.isArray(value) ? (value[0] ?? 0) : value);

const FIELDS: readonly { key: BrushOptionKey; label: string; unit: string }[] = [
  { key: "size", label: "Tamanho", unit: "px" },
  { key: "hardness", label: "Dureza", unit: "%" },
  { key: "opacity", label: "Opacidade", unit: "%" },
  { key: "flow", label: "Fluxo", unit: "%" },
  { key: "smoothing", label: "Suavização", unit: "%" },
];

function OptionField({
  name,
  label,
  value,
  min,
  max,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-end gap-2">
      <FormSlider
        name={`${name}-slider`}
        label={label}
        value={value}
        min={min}
        max={max}
        step={1}
        className="w-28"
        onValueChange={(next) => onChange(first(next))}
      />
      <FormInputNumber
        name={name}
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={1}
        className="w-20"
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      />
    </div>
  );
}

export function BrushOptionsBar({ tool, paint }: ToolOptionsProps) {
  if (!isBrushTool(tool)) return null;
  const options = paint.brush.optionsOf(tool);
  return (
    <>
      {FIELDS.map(({ key, label }) => (
        <OptionField
          key={key}
          name={`paint-${key}`}
          label={label}
          value={options[key]}
          min={key === "size" ? PAINT_LIMITS.minSize : PAINT_LIMITS.minPercent}
          max={key === "size" ? PAINT_LIMITS.maxSize : PAINT_LIMITS.maxPercent}
          onChange={(value) => paint.brush.setOption(tool, key, value)}
        />
      ))}
      {paint.reason === undefined ? null : (
        <p role="status" className="ml-2 shrink-0 text-sm text-muted-foreground">
          {paint.reason}
        </p>
      )}
    </>
  );
}

export function EyedropperOptionsBar({ paint }: ToolOptionsProps) {
  return (
    <div role="group" aria-label="Amostrar" className="flex items-center gap-1">
      <span className="mr-1 text-sm">Amostrar</span>
      {Object.values(PaintSampleMode).map((mode) => (
        <Button
          key={mode}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={paint.brush.sample === mode}
          className={cn(paint.brush.sample === mode && "bg-accent text-accent-foreground")}
          onClick={() => paint.brush.setSample(mode)}
        >
          {PAINT_SAMPLE_LABEL[mode]}
        </Button>
      ))}
    </div>
  );
}
