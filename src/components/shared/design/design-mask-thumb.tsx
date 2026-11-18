import { X } from "lucide-react";
import type { MouseEvent } from "react";
import { DesignLayerThumb } from "@/components/shared/design/design-layer-thumb";
import { type MaskableElement, maskKey, maskPixelSize } from "@/lib/shared/design/layer-mask";
import type { RasterStore } from "@/lib/shared/design/raster-store";
import { cn } from "@/lib/shared/utils";

export function DesignMaskThumb({
  store,
  element,
  targeted,
  viewed,
  onSelect,
  onView,
  onToggle,
}: {
  store: RasterStore;
  element: MaskableElement;
  targeted: boolean;
  viewed: boolean;
  onSelect: () => void;
  onView: () => void;
  onToggle: () => void;
}) {
  const enabled = element.mask?.enabled === true;
  const size = maskPixelSize(element);
  const click = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.altKey) onView();
    else if (event.shiftKey) onToggle();
    else onSelect();
  };
  return (
    <button
      type="button"
      aria-label="Máscara da camada"
      aria-pressed={targeted}
      title="Clique para pintar a máscara. Alt+clique mostra a máscara. Shift+clique desativa ou ativa."
      className={cn(
        "relative shrink-0 rounded border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        targeted ? "border-primary" : "border-transparent",
        viewed ? "ring-2 ring-ring" : null,
        enabled ? null : "opacity-50",
      )}
      onClick={click}
    >
      <DesignLayerThumb
        store={store}
        id={maskKey(element.id)}
        pixelWidth={size.width}
        pixelHeight={size.height}
      />
      {enabled ? null : (
        <X
          aria-label="Máscara desativada"
          className="absolute inset-0 m-auto size-5 text-destructive"
        />
      )}
    </button>
  );
}
