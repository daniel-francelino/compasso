import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { useState } from "react";
import { OptionField } from "@/components/shared/design/design-paint-options";
import { PixelReason } from "@/components/shared/design/design-pixel-reason";
import type { ToolOptionsProps } from "@/components/shared/design/design-tool-options";
import { Button } from "@/components/shared/ui/button";
import { SelectionCombine } from "@/lib/shared/design/raster/selection";
import {
  MARQUEE_SHAPE_LABEL,
  MarqueeShape,
  SELECTION_COMBINE_LABEL,
  SELECTION_LIMITS,
} from "@/lib/shared/design/selection-state";
import { cn } from "@/lib/shared/utils";

const RECT_FIELDS = ["x", "y", "width", "height"] as const;
const RECT_LABEL: Record<(typeof RECT_FIELDS)[number], string> = {
  x: "X",
  y: "Y",
  width: "L",
  height: "A",
};

function Toggles<T extends string>({
  label,
  values,
  labels,
  current,
  onSelect,
}: {
  label: string;
  values: readonly T[];
  labels: Record<T, string>;
  current: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-1">
      {values.map((value) => (
        <Button
          key={value}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={current === value}
          className={cn(current === value && "bg-accent text-accent-foreground")}
          onClick={() => onSelect(value)}
        >
          {labels[value]}
        </Button>
      ))}
    </div>
  );
}

function ModeToggles({ selection }: Pick<ToolOptionsProps, "selection">) {
  return (
    <Toggles
      label="Modo da seleção"
      values={Object.values(SelectionCombine)}
      labels={SELECTION_COMBINE_LABEL}
      current={selection.mode}
      onSelect={selection.setMode}
    />
  );
}

function FeatherField({ selection }: Pick<ToolOptionsProps, "selection">) {
  return (
    <OptionField
      name="selection-feather"
      label="Suavizar bordas (px)"
      value={selection.feather}
      min={0}
      max={SELECTION_LIMITS.maxFeather}
      onChange={selection.setFeather}
    />
  );
}

function RectEntry({ selection }: Pick<ToolOptionsProps, "selection">) {
  const [rect, setRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
  return (
    <div role="group" aria-label="Posição e tamanho da seleção" className="flex items-end gap-1">
      {RECT_FIELDS.map((key) => (
        <FormInputNumber
          key={key}
          name={`selection-rect-${key}`}
          aria-label={RECT_LABEL[key]}
          label={RECT_LABEL[key]}
          value={rect[key]}
          min={key === "x" || key === "y" ? 0 : 1}
          step={1}
          className="w-20"
          onValueChange={(next) => {
            if (next !== null) setRect((current) => ({ ...current, [key]: Math.round(next) }));
          }}
        />
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => selection.setRect(rect)}>
        Aplicar
      </Button>
    </div>
  );
}

export function MarqueeOptions({ selection }: ToolOptionsProps) {
  return (
    <>
      <ModeToggles selection={selection} />
      <Toggles
        label="Forma da seleção"
        values={Object.values(MarqueeShape)}
        labels={MARQUEE_SHAPE_LABEL}
        current={selection.shape}
        onSelect={selection.setShape}
      />
      <FeatherField selection={selection} />
      <RectEntry selection={selection} />
    </>
  );
}

export function LassoOptions({ selection }: ToolOptionsProps) {
  return (
    <>
      <ModeToggles selection={selection} />
      <FeatherField selection={selection} />
      <p className="shrink-0 text-sm text-muted-foreground">
        Arraste para o laço livre ou clique para pontos. Enter fecha, Esc cancela.
      </p>
    </>
  );
}

export function WandOptions({ selection, editor, onRasterize }: ToolOptionsProps) {
  return (
    <>
      <ModeToggles selection={selection} />
      <OptionField
        name="selection-tolerance"
        label="Tolerância"
        value={selection.tolerance}
        min={0}
        max={SELECTION_LIMITS.maxTolerance}
        onChange={selection.setTolerance}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={selection.contiguous}
        className={cn(selection.contiguous && "bg-accent text-accent-foreground")}
        onClick={() => selection.setContiguous(!selection.contiguous)}
      >
        Contíguo
      </Button>
      <PixelReason text={selection.notice} single={editor.single} onRasterize={onRasterize} />
    </>
  );
}
