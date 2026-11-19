import { Button } from "@/components/shared/ui/button";
import {
  RASTERIZE_VECTOR_LABEL,
  type RasterizableElement,
  VECTOR_PIXEL_REASON,
} from "@/lib/shared/design/rasterize";
import type { DesignElement } from "@/lib/shared/design/schemas";
import { DesignElementKind } from "@/lib/shared/design/types";

export function PixelReason({
  text,
  single,
  onRasterize,
}: {
  text: string | null | undefined;
  single: DesignElement | undefined;
  onRasterize: (element: RasterizableElement) => void;
}) {
  if (text === undefined || text === null) return null;
  return (
    <>
      <p role="status" className="ml-2 shrink-0 text-sm text-muted-foreground">
        {text}
      </p>
      {text === VECTOR_PIXEL_REASON && single?.kind === DesignElementKind.Path ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onRasterize(single)}>
          {RASTERIZE_VECTOR_LABEL}
        </Button>
      ) : null}
    </>
  );
}
