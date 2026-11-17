import { Bold, Italic } from "lucide-react";
import { FormColorPicker } from "lost-ui/forms/form-color-picker";
import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { FormSelect } from "lost-ui/forms/form-select";
import { FormSwitch } from "lost-ui/forms/form-switch";
import { FormTextarea } from "lost-ui/forms/form-textarea";
import { Button } from "@/components/shared/ui/button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { inRange, normalizeColor } from "@/lib/shared/design/document";
import type { TextElement, TextShadow } from "@/lib/shared/design/schemas";
import {
  DESIGN_ALIGN_LABEL,
  DESIGN_FONT_LABEL,
  DESIGN_LIMITS,
  DesignFont,
  DesignTextAlign,
} from "@/lib/shared/design/types";

const alignItems = Object.values(DesignTextAlign).map((align) => ({
  value: align,
  label: DESIGN_ALIGN_LABEL[align],
}));

const allFonts = Object.values(DesignFont);
const asFont = (value: string) => allFonts.find((font) => font === value);
const asAlign = (value: string) => alignItems.find((item) => item.value === value)?.value;

const fontItems = (brandFonts: readonly DesignFont[]) => [
  ...brandFonts.map((font) => ({
    value: font,
    label: DESIGN_FONT_LABEL[font],
    description: "Fonte da marca",
  })),
  ...allFonts
    .filter((font) => !brandFonts.includes(font))
    .map((font) => ({ value: font, label: DESIGN_FONT_LABEL[font] })),
];

function ShadowFields({
  shadow,
  swatches,
  disabled,
  onChange,
}: {
  shadow: TextShadow;
  swatches: string[];
  disabled: boolean;
  onChange: (shadow: TextShadow, field: string) => void;
}) {
  const offset = DESIGN_LIMITS.maxShadowOffset;
  return (
    <div className="space-y-3 rounded-md border p-3">
      <FormColorPicker
        name="shadowColor"
        label="Cor da sombra"
        value={shadow.color}
        swatches={swatches}
        disabled={disabled}
        onValueChange={(value) => {
          const color = normalizeColor(value);
          if (color !== null) onChange({ ...shadow, color }, "shadowColor");
        }}
      />
      <div className="grid grid-cols-3 gap-2">
        <FormInputNumber
          name="shadowBlur"
          label="Desfoque"
          value={shadow.blur}
          min={0}
          max={DESIGN_LIMITS.maxShadowBlur}
          showControls={false}
          disabled={disabled}
          onValueChange={(value) => {
            if (inRange(value, 0, DESIGN_LIMITS.maxShadowBlur)) {
              onChange({ ...shadow, blur: value }, "shadowBlur");
            }
          }}
        />
        <FormInputNumber
          name="shadowX"
          label="Desvio X"
          value={shadow.offsetX}
          min={-offset}
          max={offset}
          showControls={false}
          disabled={disabled}
          onValueChange={(value) => {
            if (inRange(value, -offset, offset)) onChange({ ...shadow, offsetX: value }, "shadowX");
          }}
        />
        <FormInputNumber
          name="shadowY"
          label="Desvio Y"
          value={shadow.offsetY}
          min={-offset}
          max={offset}
          showControls={false}
          disabled={disabled}
          onValueChange={(value) => {
            if (inRange(value, -offset, offset)) onChange({ ...shadow, offsetY: value }, "shadowY");
          }}
        />
      </div>
    </div>
  );
}

export function DesignTextProperties({
  element,
  editor,
  disabled,
  swatches,
  brandFonts,
}: {
  element: TextElement;
  editor: DesignEditor;
  disabled: boolean;
  swatches: string[];
  brandFonts: readonly DesignFont[];
}) {
  const id = element.id;
  return (
    <div className="space-y-3">
      <FormTextarea
        id="design-text"
        name="text"
        label="Texto"
        value={element.text}
        rows={3}
        disabled={disabled}
        hint={`${element.text.length} de ${DESIGN_LIMITS.maxText} caracteres`}
        onValueChange={(text) => editor.patchText(id, { text }, `text:${id}`)}
      />
      <FormSelect
        name="font"
        label="Fonte"
        value={element.font}
        items={fontItems(brandFonts)}
        disabled={disabled}
        onValueChange={(value) => {
          const font = asFont(value);
          if (font !== undefined) editor.patchText(id, { font });
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormInputNumber
          name="fontSize"
          label="Tamanho"
          value={element.fontSize}
          min={DESIGN_LIMITS.minFontSize}
          max={DESIGN_LIMITS.maxFontSize}
          disabled={disabled}
          onValueChange={(value) => {
            if (inRange(value, DESIGN_LIMITS.minFontSize, DESIGN_LIMITS.maxFontSize)) {
              editor.patchText(id, { fontSize: value }, `fontSize:${id}`);
            }
          }}
        />
        <FormInputNumber
          name="lineHeight"
          label="Entrelinha"
          value={element.lineHeight}
          min={DESIGN_LIMITS.minLineHeight}
          max={DESIGN_LIMITS.maxLineHeight}
          step={0.1}
          disabled={disabled}
          onValueChange={(value) => {
            if (inRange(value, DESIGN_LIMITS.minLineHeight, DESIGN_LIMITS.maxLineHeight)) {
              editor.patchText(id, { lineHeight: value }, `lineHeight:${id}`);
            }
          }}
        />
      </div>
      <div className="flex gap-2" role="group" aria-label="Estilo do texto">
        <Button
          type="button"
          variant={element.bold ? "secondary" : "outline"}
          size="sm"
          aria-pressed={element.bold}
          disabled={disabled}
          onClick={() => editor.patchText(id, { bold: !element.bold })}
        >
          <Bold aria-hidden="true" />
          Negrito
        </Button>
        <Button
          type="button"
          variant={element.italic ? "secondary" : "outline"}
          size="sm"
          aria-pressed={element.italic}
          disabled={disabled}
          onClick={() => editor.patchText(id, { italic: !element.italic })}
        >
          <Italic aria-hidden="true" />
          Itálico
        </Button>
      </div>
      <FormSelect
        name="align"
        label="Alinhamento"
        value={element.align}
        items={alignItems}
        disabled={disabled}
        onValueChange={(value) => {
          const align = asAlign(value);
          if (align !== undefined) editor.patchText(id, { align });
        }}
      />
      <FormColorPicker
        name="color"
        label="Cor do texto"
        value={element.color}
        swatches={swatches}
        disabled={disabled}
        onValueChange={(value) => {
          const color = normalizeColor(value);
          if (color !== null) editor.patchText(id, { color }, `color:${id}`);
        }}
      />
      <FormSwitch
        name="shadow"
        label="Sombra"
        value={element.shadow !== null}
        disabled={disabled}
        onValueChange={(on) =>
          editor.patchText(id, {
            shadow: on ? { color: element.color, blur: 12, offsetX: 4, offsetY: 4 } : null,
          })
        }
      />
      {element.shadow === null ? null : (
        <ShadowFields
          shadow={element.shadow}
          swatches={swatches}
          disabled={disabled}
          onChange={(shadow, field) => editor.patchText(id, { shadow }, `${field}:${id}`)}
        />
      )}
    </div>
  );
}
