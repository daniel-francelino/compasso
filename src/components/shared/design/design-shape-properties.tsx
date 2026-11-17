import { FormColorPicker } from "lost-ui/forms/form-color-picker";
import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { FormSwitch } from "lost-ui/forms/form-switch";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { inRange, normalizeColor } from "@/lib/shared/design/document";
import type { EllipseElement, LineElement, RectElement } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignElementKind } from "@/lib/shared/design/types";

function LineProperties({
  element,
  editor,
  disabled,
  swatches,
}: {
  element: LineElement;
  editor: DesignEditor;
  disabled: boolean;
  swatches: string[];
}) {
  const id = element.id;
  return (
    <div className="space-y-3">
      <FormColorPicker
        name="stroke"
        label="Cor da linha"
        value={element.stroke}
        swatches={swatches}
        disabled={disabled}
        onValueChange={(value) => {
          const stroke = normalizeColor(value);
          if (stroke !== null) editor.patchLine(id, { stroke }, `stroke:${id}`);
        }}
      />
      <FormInputNumber
        name="strokeWidth"
        label="Espessura"
        value={element.strokeWidth}
        min={DESIGN_LIMITS.minStroke}
        max={DESIGN_LIMITS.maxStroke}
        disabled={disabled}
        onValueChange={(value) => {
          if (inRange(value, DESIGN_LIMITS.minStroke, DESIGN_LIMITS.maxStroke)) {
            editor.patchLine(id, { strokeWidth: value }, `strokeWidth:${id}`);
          }
        }}
      />
      <FormSwitch
        name="dashed"
        label="Tracejada"
        value={element.dashed}
        disabled={disabled}
        onValueChange={(dashed) => editor.patchLine(id, { dashed })}
      />
    </div>
  );
}

export function DesignShapeProperties({
  element,
  editor,
  disabled,
  swatches,
}: {
  element: RectElement | EllipseElement | LineElement;
  editor: DesignEditor;
  disabled: boolean;
  swatches: string[];
}) {
  if (element.kind === DesignElementKind.Line) {
    return (
      <LineProperties element={element} editor={editor} disabled={disabled} swatches={swatches} />
    );
  }
  const id = element.id;
  return (
    <div className="space-y-3">
      <FormColorPicker
        name="fill"
        label="Cor de preenchimento"
        value={element.fill}
        swatches={swatches}
        disabled={disabled}
        onValueChange={(value) => {
          const fill = normalizeColor(value);
          if (fill !== null) editor.patchShape(id, { fill }, `fill:${id}`);
        }}
      />
      {element.kind === DesignElementKind.Rect ? (
        <FormInputNumber
          name="cornerRadius"
          label="Arredondamento dos cantos"
          value={element.cornerRadius}
          min={0}
          max={DESIGN_LIMITS.maxCornerRadius}
          disabled={disabled}
          onValueChange={(value) => {
            if (inRange(value, 0, DESIGN_LIMITS.maxCornerRadius)) {
              editor.patchShape(id, { cornerRadius: value }, `corner:${id}`);
            }
          }}
        />
      ) : null}
    </div>
  );
}
