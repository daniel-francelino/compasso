import type { ToolOptionsProps } from "@/components/shared/design/design-tool-options";
import { Button } from "@/components/shared/ui/button";
import { CROP_HINT, CROP_RATIO_LABEL, CropRatio } from "@/lib/shared/design/crop";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { cn } from "@/lib/shared/utils";

export const TRANSFORM_HINT = "Arraste as alças para escalar e girar. Enter aplica, Esc cancela.";

export function CropOptions({ crop }: ToolOptionsProps) {
  return (
    <>
      <div role="group" aria-label="Proporção" className="flex shrink-0 items-center gap-1">
        {Object.values(CropRatio).map((ratio) => (
          <Button
            key={ratio}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={crop.ratio === ratio}
            className={cn(crop.ratio === ratio && "bg-accent text-accent-foreground")}
            onClick={() => crop.setRatio(ratio)}
          >
            {CROP_RATIO_LABEL[ratio]}
          </Button>
        ))}
      </div>
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {crop.box.width} × {crop.box.height} px
      </span>
      <Button
        type="button"
        size="sm"
        disabled={crop.reason !== undefined}
        title={crop.reason}
        onClick={crop.commit}
      >
        Aplicar corte
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={crop.cancel}>
        Cancelar
      </Button>
      <p className="hidden truncate text-sm text-muted-foreground lg:block">
        {crop.reason ?? CROP_HINT}
      </p>
    </>
  );
}

export function TransformOptions({ editor }: { editor: DesignEditor }) {
  return (
    <>
      <Button type="button" size="sm" onClick={editor.commitTransform}>
        Aplicar
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={editor.cancelTransform}>
        Cancelar
      </Button>
      <p className="truncate text-sm text-muted-foreground">{TRANSFORM_HINT}</p>
    </>
  );
}
