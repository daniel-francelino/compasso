import { FormSelect } from "lost-ui/forms/form-select";
import { FormSlider } from "lost-ui/forms/form-slider";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignElement } from "@/lib/shared/design/schemas";
import { DESIGN_BLEND_MODE_LABEL, DesignBlendMode } from "@/lib/shared/design/types";

const BLEND_ITEMS = Object.values(DesignBlendMode).map((value) => ({
  value,
  label: DESIGN_BLEND_MODE_LABEL[value],
}));

const asBlendMode = (value: string) => BLEND_ITEMS.find((item) => item.value === value)?.value;

const first = (value: number | number[]) => (Array.isArray(value) ? (value[0] ?? 0) : value);

export function DesignBlendControls({
  editor,
  element,
  disabled,
  showFill,
  idPrefix,
}: {
  editor: DesignEditor;
  element: DesignElement;
  disabled: boolean;
  showFill: boolean;
  idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      <FormSelect
        name={`${idPrefix}blendMode`}
        label="Mistura"
        value={element.blendMode}
        items={BLEND_ITEMS}
        disabled={disabled}
        onValueChange={(value) => {
          const blendMode = asBlendMode(value);
          if (blendMode !== undefined) editor.patch(element.id, { blendMode });
        }}
      />
      <FormSlider
        name={`${idPrefix}opacity`}
        label="Opacidade"
        value={Math.round(element.opacity * 100)}
        min={0}
        max={100}
        step={1}
        showValue
        disabled={disabled}
        onValueChange={(value) =>
          editor.patch(element.id, { opacity: first(value) / 100 }, `opacity:${element.id}`)
        }
      />
      {showFill ? (
        <FormSlider
          name={`${idPrefix}fillOpacity`}
          label="Preenchimento"
          value={Math.round(element.fillOpacity * 100)}
          min={0}
          max={100}
          step={1}
          showValue
          disabled={disabled}
          onValueChange={(value) =>
            editor.patch(
              element.id,
              { fillOpacity: first(value) / 100 },
              `fillOpacity:${element.id}`,
            )
          }
        />
      ) : null}
    </div>
  );
}
