import { RotateCcw } from "lucide-react";
import { AdjustmentControls } from "@/components/shared/design/design-adjustment-controls";
import { Button } from "@/components/shared/ui/button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { ADJUSTMENT_HINT } from "@/lib/shared/design/adjustment-layers";
import { ADJUSTMENT_TYPE_LABEL, AdjustmentType } from "@/lib/shared/design/raster/adjustment-types";
import { defaultAdjustment } from "@/lib/shared/design/raster/adjustments";
import { DesignElementKind, type PageSize } from "@/lib/shared/design/types";

export function DesignAdjustmentsPanel({
  editor,
  editable,
  size,
}: {
  editor: DesignEditor;
  editable: boolean;
  size: PageSize;
}) {
  const element = editor.single;
  const current = element?.kind === DesignElementKind.Adjustment ? element : null;
  const disabled = !editable || (current?.locked ?? false);
  return (
    <section aria-labelledby="design-adjustments-title" className="space-y-3">
      <h2 id="design-adjustments-title" className="text-sm font-semibold">
        Ajustes
      </h2>
      <p className="text-xs text-muted-foreground">{ADJUSTMENT_HINT}</p>
      {editable ? (
        <div role="group" aria-label="Adicionar ajuste" className="grid grid-cols-2 gap-1">
          {Object.values(AdjustmentType).map((type) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              size="sm"
              disabled={!editor.canAdd()}
              onClick={() => editor.addAdjustment(type, size)}
            >
              {ADJUSTMENT_TYPE_LABEL[type]}
            </Button>
          ))}
        </div>
      ) : null}
      {current === null ? (
        <p className="text-sm text-muted-foreground">
          Selecione uma camada de ajuste na lista de camadas para editar os parâmetros.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {ADJUSTMENT_TYPE_LABEL[current.adjustment.type]}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() =>
                editor.patchAdjustment(current.id, defaultAdjustment(current.adjustment.type))
              }
            >
              <RotateCcw aria-hidden="true" />
              Restaurar valores
            </Button>
          </div>
          <AdjustmentControls
            params={current.adjustment}
            disabled={disabled}
            onChange={(next) =>
              editor.patchAdjustment(current.id, next, `adjustment:${current.id}`)
            }
          />
        </div>
      )}
    </section>
  );
}
