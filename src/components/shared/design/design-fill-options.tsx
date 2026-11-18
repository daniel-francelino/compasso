import { FormSelect } from "lost-ui/forms/form-select";
import { OptionField, ToggleButton } from "@/components/shared/design/design-paint-options";
import type { ToolOptionsProps } from "@/components/shared/design/design-tool-options";
import { BLEND_ITEMS, asBlendMode } from "@/lib/shared/design/blend-items";
import { FILL_LIMITS, GRADIENT_KIND_LABEL, GradientKind } from "@/lib/shared/design/fill-tools";
import type { DesignBlendMode } from "@/lib/shared/design/types";

function BlendField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: DesignBlendMode;
  onChange: (mode: DesignBlendMode) => void;
}) {
  return (
    <FormSelect
      name={name}
      label="Mistura"
      value={value}
      items={BLEND_ITEMS}
      className="w-44 shrink-0"
      onValueChange={(next) => {
        const mode = asBlendMode(next);
        if (mode !== undefined) onChange(mode);
      }}
    />
  );
}

function Reason({ text }: { text: string | undefined }) {
  return text === undefined ? null : (
    <p role="status" className="ml-2 shrink-0 text-sm text-muted-foreground">
      {text}
    </p>
  );
}

export function BucketOptionsBar({ paint }: ToolOptionsProps) {
  const { bucket, setBucket } = paint.fill;
  return (
    <>
      <OptionField
        name="fill-tolerance"
        label="Tolerância"
        value={bucket.tolerance}
        min={FILL_LIMITS.minTolerance}
        max={FILL_LIMITS.maxTolerance}
        onChange={(tolerance) => setBucket({ tolerance })}
      />
      <ToggleButton
        label="Contíguo"
        pressed={bucket.contiguous}
        onToggle={() => setBucket({ contiguous: !bucket.contiguous })}
      />
      <OptionField
        name="fill-opacity"
        label="Opacidade"
        value={bucket.opacity}
        min={FILL_LIMITS.minPercent}
        max={FILL_LIMITS.maxPercent}
        onChange={(opacity) => setBucket({ opacity })}
      />
      <BlendField
        name="fill-blend"
        value={bucket.blendMode}
        onChange={(blendMode) => setBucket({ blendMode })}
      />
      <Reason text={paint.reason} />
    </>
  );
}

export function GradientOptionsBar({ paint }: ToolOptionsProps) {
  const { gradient, setGradient } = paint.fill;
  return (
    <>
      <div role="group" aria-label="Tipo" className="flex shrink-0 items-center gap-1">
        {Object.values(GradientKind).map((kind) => (
          <ToggleButton
            key={kind}
            label={GRADIENT_KIND_LABEL[kind]}
            pressed={gradient.kind === kind}
            onToggle={() => setGradient({ kind })}
          />
        ))}
      </div>
      <ToggleButton
        label="Inverter cores"
        pressed={gradient.reverse}
        onToggle={() => setGradient({ reverse: !gradient.reverse })}
      />
      <OptionField
        name="gradient-opacity"
        label="Opacidade"
        value={gradient.opacity}
        min={FILL_LIMITS.minPercent}
        max={FILL_LIMITS.maxPercent}
        onChange={(opacity) => setGradient({ opacity })}
      />
      <BlendField
        name="gradient-blend"
        value={gradient.blendMode}
        onChange={(blendMode) => setGradient({ blendMode })}
      />
      <Reason text={paint.reason} />
    </>
  );
}
