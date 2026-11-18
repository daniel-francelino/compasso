import { useMemo } from "react";
import { Image as KonvaImage } from "react-konva";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import type { InheritedLayer } from "@/lib/shared/design/document";
import { renderStack } from "@/lib/shared/design/raster-canvas";
import type { PageSize } from "@/lib/shared/design/types";

export function DesignRasterStack({
  layers,
  rasters,
  size,
}: {
  layers: readonly InheritedLayer[];
  rasters: RasterHandle;
  size: PageSize;
}) {
  const { store, revision } = rasters;
  const canvas = useMemo(
    () => (revision < 0 ? null : renderStack(layers, store, size)),
    [layers, store, revision, size],
  );
  if (canvas === null) return null;
  return (
    <KonvaImage
      image={canvas}
      width={size.width}
      height={size.height}
      listening={false}
      name="design-raster-stack"
    />
  );
}
