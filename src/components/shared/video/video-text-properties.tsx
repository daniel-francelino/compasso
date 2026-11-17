import { FormColorPicker } from "lost-ui/forms/form-color-picker";
import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { FormSelect } from "lost-ui/forms/form-select";
import { FormSwitch } from "lost-ui/forms/form-switch";
import { FormTextarea } from "lost-ui/forms/form-textarea";
import type { VideoEditor } from "@/hooks/shared/video/use-video-editor";
import { inRange, normalizeColor } from "@/lib/shared/design/document";
import {
  DESIGN_ALIGN_LABEL,
  DESIGN_FONT_LABEL,
  DesignFont,
  DesignTextAlign,
} from "@/lib/shared/design/types";
import type { TextClip } from "@/lib/shared/video/schemas";
import { VIDEO_LIMITS } from "@/lib/shared/video/types";

const fontItems = Object.values(DesignFont).map((font) => ({
  value: font,
  label: DESIGN_FONT_LABEL[font],
}));
const alignItems = Object.values(DesignTextAlign).map((align) => ({
  value: align,
  label: DESIGN_ALIGN_LABEL[align],
}));
const asFont = (value: string) => fontItems.find((item) => item.value === value)?.value;
const asAlign = (value: string) => alignItems.find((item) => item.value === value)?.value;

export function VideoTextProperties({
  clip,
  editor,
  disabled,
  defaultBackground,
}: {
  clip: TextClip;
  editor: VideoEditor;
  disabled: boolean;
  defaultBackground: string;
}) {
  const id = clip.id;
  const patch = (value: Partial<TextClip>, field: string) =>
    editor.patchText(id, value, `${field}:${id}`);
  const coordinate = VIDEO_LIMITS.maxCoordinate;

  return (
    <div className="space-y-3">
      <FormTextarea
        id="video-text"
        name="text"
        label="Texto"
        value={clip.text}
        rows={3}
        disabled={disabled}
        hint={`${clip.text.length} de ${VIDEO_LIMITS.maxText} caracteres`}
        onValueChange={(text) => patch({ text: text.slice(0, VIDEO_LIMITS.maxText) }, "text")}
      />
      <FormSelect
        name="font"
        label="Fonte"
        value={clip.font}
        items={fontItems}
        disabled={disabled}
        onValueChange={(value) => {
          const font = asFont(value);
          if (font !== undefined) patch({ font }, "font");
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        <FormInputNumber
          name="fontSize"
          label="Tamanho"
          value={clip.fontSize}
          min={VIDEO_LIMITS.minFontSize}
          max={VIDEO_LIMITS.maxFontSize}
          disabled={disabled}
          onValueChange={(value) => {
            if (inRange(value, VIDEO_LIMITS.minFontSize, VIDEO_LIMITS.maxFontSize)) {
              patch({ fontSize: value }, "fontSize");
            }
          }}
        />
        <FormSelect
          name="align"
          label="Alinhamento"
          value={clip.align}
          items={alignItems}
          disabled={disabled}
          onValueChange={(value) => {
            const align = asAlign(value);
            if (align !== undefined) patch({ align }, "align");
          }}
        />
      </div>
      <div className="flex gap-4">
        <FormSwitch
          name="bold"
          label="Negrito"
          value={clip.bold}
          disabled={disabled}
          onValueChange={(bold) => patch({ bold }, "bold")}
        />
        <FormSwitch
          name="italic"
          label="Itálico"
          value={clip.italic}
          disabled={disabled}
          onValueChange={(italic) => patch({ italic }, "italic")}
        />
      </div>
      <FormColorPicker
        name="color"
        label="Cor do texto"
        value={clip.color}
        disabled={disabled}
        onValueChange={(value) => {
          const color = normalizeColor(value);
          if (color !== null) patch({ color }, "color");
        }}
      />
      <FormSwitch
        name="hasBackground"
        label="Caixa atrás do texto"
        value={clip.background !== null}
        disabled={disabled}
        onValueChange={(on) => patch({ background: on ? defaultBackground : null }, "background")}
      />
      {clip.background === null ? null : (
        <FormColorPicker
          name="background"
          label="Cor da caixa"
          value={clip.background}
          disabled={disabled}
          onValueChange={(value) => {
            const color = normalizeColor(value);
            if (color !== null) patch({ background: color }, "background");
          }}
        />
      )}
      <div className="grid grid-cols-3 gap-2">
        <FormInputNumber
          name="textX"
          label="X"
          value={Math.round(clip.x)}
          min={-coordinate}
          max={coordinate}
          showControls={false}
          disabled={disabled}
          onValueChange={(x) => inRange(x, -coordinate, coordinate) && patch({ x }, "x")}
        />
        <FormInputNumber
          name="textY"
          label="Y"
          value={Math.round(clip.y)}
          min={-coordinate}
          max={coordinate}
          showControls={false}
          disabled={disabled}
          onValueChange={(y) => inRange(y, -coordinate, coordinate) && patch({ y }, "y")}
        />
        <FormInputNumber
          name="textWidth"
          label="Largura"
          value={Math.round(clip.width)}
          min={VIDEO_LIMITS.minSize}
          max={VIDEO_LIMITS.maxSize}
          showControls={false}
          disabled={disabled}
          onValueChange={(width) =>
            inRange(width, VIDEO_LIMITS.minSize, VIDEO_LIMITS.maxSize) && patch({ width }, "width")
          }
        />
      </div>
    </div>
  );
}
