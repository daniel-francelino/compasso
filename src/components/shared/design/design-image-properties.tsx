import { FlipHorizontal2, FlipVertical2 } from "lucide-react";
import { FormSlider } from "lost-ui/forms/form-slider";
import { FormTextarea } from "lost-ui/forms/form-textarea";
import { Button } from "@/components/shared/ui/button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { ImagePatch } from "@/lib/shared/design/document";
import type { ImageElement } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const first = (value: number | number[]) => (Array.isArray(value) ? (value[0] ?? 0) : value);

type SliderSpec = {
  key: "zoom" | "focusX" | "focusY" | "brightness" | "contrast";
  label: string;
  min: number;
  max: number;
  factor: number;
};

const sliders: SliderSpec[] = [
  { key: "zoom", label: "Zoom (%)", min: 100, max: DESIGN_LIMITS.maxZoom * 100, factor: 100 },
  { key: "focusX", label: "Foco horizontal (%)", min: 0, max: 100, factor: 100 },
  { key: "focusY", label: "Foco vertical (%)", min: 0, max: 100, factor: 100 },
  {
    key: "brightness",
    label: "Brilho",
    min: -DESIGN_LIMITS.maxBrightness * 100,
    max: DESIGN_LIMITS.maxBrightness * 100,
    factor: 100,
  },
  {
    key: "contrast",
    label: "Contraste",
    min: -DESIGN_LIMITS.maxContrast,
    max: DESIGN_LIMITS.maxContrast,
    factor: 1,
  },
];

export function DesignImageProperties({
  element,
  editor,
  disabled,
}: {
  element: ImageElement;
  editor: DesignEditor;
  disabled: boolean;
}) {
  const id = element.id;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Espelhar imagem">
        <Button
          type="button"
          size="sm"
          variant={element.flipX ? "secondary" : "outline"}
          aria-pressed={element.flipX}
          disabled={disabled}
          onClick={() => editor.patchImage(id, { flipX: !element.flipX })}
        >
          <FlipHorizontal2 aria-hidden="true" />
          Espelhar na horizontal
        </Button>
        <Button
          type="button"
          size="sm"
          variant={element.flipY ? "secondary" : "outline"}
          aria-pressed={element.flipY}
          disabled={disabled}
          onClick={() => editor.patchImage(id, { flipY: !element.flipY })}
        >
          <FlipVertical2 aria-hidden="true" />
          Espelhar na vertical
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        A imagem sempre preenche o quadro. Mude o tamanho do quadro para recortar e use o zoom e o
        foco para escolher a parte visível.
      </p>
      {sliders.map((spec) => (
        <FormSlider
          key={spec.key}
          name={spec.key}
          label={spec.label}
          value={Math.round(element[spec.key] * spec.factor)}
          min={spec.min}
          max={spec.max}
          step={1}
          showValue
          disabled={disabled}
          onValueChange={(value) => {
            const patch: ImagePatch = { [spec.key]: first(value) / spec.factor };
            editor.patchImage(id, patch, `${spec.key}:${id}`);
          }}
        />
      ))}
      <FormTextarea
        name="alt"
        label="Texto alternativo"
        value={element.alt}
        rows={2}
        disabled={disabled}
        hint={`Descreva a imagem para quem usa leitor de tela. ${element.alt.length} de ${DESIGN_LIMITS.maxAlt} caracteres.`}
        onValueChange={(alt) => editor.patchImage(id, { alt }, `alt:${id}`)}
      />
    </div>
  );
}
