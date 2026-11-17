import { useState } from "react";
import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { FormSwitch } from "lost-ui/forms/form-switch";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { selectionBox } from "@/lib/shared/design/arrange";
import { type Box, inRange } from "@/lib/shared/design/document";
import { DESIGN_LIMITS, DesignElementKind } from "@/lib/shared/design/types";

type Field = "x" | "y" | "width" | "height";

const FIELDS: { key: Field; label: string; min: number; max: number }[] = [
  { key: "x", label: "X", min: -DESIGN_LIMITS.maxCoordinate, max: DESIGN_LIMITS.maxCoordinate },
  { key: "y", label: "Y", min: -DESIGN_LIMITS.maxCoordinate, max: DESIGN_LIMITS.maxCoordinate },
  { key: "width", label: "Largura", min: DESIGN_LIMITS.minSize, max: DESIGN_LIMITS.maxSize },
  { key: "height", label: "Altura", min: DESIGN_LIMITS.minSize, max: DESIGN_LIMITS.maxSize },
];

const resized = (box: Box, key: Field, value: number, keepRatio: boolean): Box => {
  const next = { ...box, [key]: value };
  if (!keepRatio || box.width === 0 || box.height === 0) return next;
  if (key === "width") return { ...next, height: Math.round((value * box.height) / box.width) };
  if (key === "height") return { ...next, width: Math.round((value * box.width) / box.height) };
  return next;
};

export function DesignTransformPanel({
  editor,
  editable,
}: {
  editor: DesignEditor;
  editable: boolean;
}) {
  const [keepRatio, setKeepRatio] = useState(false);
  const ids = editor.selectedIds;
  const box = selectionBox(editor.page, ids);
  const single = editor.single;
  const disabled = !editable || editor.selected.every((element) => element.locked);
  const onlyText =
    editor.selected.length > 0 &&
    editor.selected.every((element) => element.kind === DesignElementKind.Text);

  if (box === null) {
    return <p className="text-sm text-muted-foreground">Selecione um elemento para transformar.</p>;
  }

  const setField = (field: (typeof FIELDS)[number], value: number | null) => {
    if (!inRange(value, field.min, field.max)) return;
    editor.transformSelection(
      resized(box, field.key, value, keepRatio && !onlyText),
      `transform:${field.key}:${ids.join(",")}`,
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((field) => (
          <FormInputNumber
            key={field.key}
            name={`transform-${field.key}`}
            label={field.label}
            value={Math.round(box[field.key])}
            min={field.min}
            max={field.max}
            disabled={disabled || (field.key === "height" && onlyText)}
            onValueChange={(value) => setField(field, value)}
          />
        ))}
        <FormInputNumber
          name="transform-rotation"
          label="Rotação (graus)"
          value={Math.round(single?.rotation ?? 0)}
          min={-360}
          max={360}
          disabled={disabled || single === undefined}
          onValueChange={(value) => {
            if (single === undefined || !inRange(value, -360, 360)) return;
            editor.patch(single.id, { rotation: value }, `rotation:${single.id}`);
          }}
        />
      </div>
      <FormSwitch
        name="keepRatio"
        label="Manter proporção"
        value={keepRatio}
        disabled={disabled || onlyText}
        onValueChange={setKeepRatio}
      />
      {single === undefined ? (
        <p className="text-sm text-muted-foreground">
          Os valores são da caixa que envolve a seleção: mudar o tamanho redimensiona todos.
        </p>
      ) : null}
    </div>
  );
}
