import { FormColorPicker } from "lost-ui/forms/form-color-picker";
import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { FieldGroup } from "@/components/shared/admin/field-group";
import { Button } from "@/components/shared/ui/button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { inRange, normalizeColor } from "@/lib/shared/design/document";
import { type GradientPaint, type PathStop, gradientCss } from "@/lib/shared/design/path";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const TARGET = "min-h-11 min-w-11";

const replaceStop = (stops: readonly PathStop[], index: number, change: Partial<PathStop>) =>
  stops.map((stop, at) => (at === index ? { ...stop, ...change } : stop));

export function DesignPathStops({
  id,
  paint,
  editor,
  disabled,
  swatches,
}: {
  id: string;
  paint: GradientPaint;
  editor: DesignEditor;
  disabled: boolean;
  swatches: string[];
}) {
  const stops = paint.stops;
  const update = (next: PathStop[], mergeKey?: string) =>
    editor.patchPath(id, { fill: { ...paint, stops: next } }, mergeKey);
  const full = stops.length >= DESIGN_LIMITS.maxGradientStops;
  const least = stops.length <= DESIGN_LIMITS.minGradientStops;
  const last = stops[stops.length - 1];
  const addReason = `O gradiente aceita até ${DESIGN_LIMITS.maxGradientStops} cores.`;
  const removeReason = `O gradiente precisa de pelo menos ${DESIGN_LIMITS.minGradientStops} cores.`;

  return (
    <FieldGroup legend="Cores do gradiente" gap="sm" disabled={disabled}>
      <div
        aria-hidden="true"
        className="h-3 w-full rounded border"
        style={{ backgroundImage: gradientCss(stops) }}
      />
      {stops.map((stop, index) => {
        const number = index + 1;
        return (
          <div key={number} className="space-y-2 rounded-md border p-2">
            <FormColorPicker
              name={`pathStopColor${number}`}
              label={`Cor ${number}`}
              value={stop.color}
              swatches={swatches}
              disabled={disabled}
              onValueChange={(value) => {
                const color = normalizeColor(value);
                if (color === null) return;
                update(replaceStop(stops, index, { color }), `pathStopColor:${id}:${index}`);
              }}
            />
            <FormInputNumber
              name={`pathStopOffset${number}`}
              label={`Posição ${number} (%)`}
              value={Math.round(stop.offset * 100)}
              min={0}
              max={100}
              disabled={disabled}
              onValueChange={(value) => {
                if (!inRange(value, 0, 100)) return;
                update(
                  replaceStop(stops, index, { offset: value / 100 }),
                  `pathStopOffset:${id}:${index}`,
                );
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={TARGET}
              disabled={disabled || least}
              onClick={() => update(stops.filter((_, at) => at !== index))}
            >
              Remover cor {number}
            </Button>
          </div>
        );
      })}
      {least ? <p className="text-sm text-muted-foreground">{removeReason}</p> : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={TARGET}
        disabled={disabled || full || last === undefined}
        onClick={() => {
          if (last !== undefined) update([...stops, { ...last, offset: 0.5 }]);
        }}
      >
        Adicionar cor
      </Button>
      {full ? <p className="text-sm text-muted-foreground">{addReason}</p> : null}
    </FieldGroup>
  );
}
