import type Konva from "konva";
import { useEffect, useMemo, useRef } from "react";
import { Image as KonvaImage } from "react-konva";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import { renderRun } from "@/lib/shared/design/raster-canvas";
import type { RasterRun } from "@/lib/shared/design/raster-runs";
import type { PageSize } from "@/lib/shared/design/types";

export function DesignRasterStack({
  run,
  rasters,
  size,
}: {
  run: RasterRun;
  rasters: RasterHandle;
  size: PageSize;
}) {
  const { store, revision } = rasters;
  const ref = useRef<Konva.Image>(null);
  const canvas = useMemo(
    () => (revision < 0 ? null : renderRun(run.layers, store, size)),
    [run, store, revision, size],
  );

  useEffect(() => {
    ref.current?.getLayer()?.batchDraw();
  });

  if (canvas === null) return null;
  return (
    <KonvaImage
      ref={ref}
      image={canvas}
      width={size.width}
      height={size.height}
      listening={false}
      name="design-raster-stack"
    />
  );
}
