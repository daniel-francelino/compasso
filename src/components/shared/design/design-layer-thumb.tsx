import { useEffect, useRef } from "react";
import { checkerboard } from "@/components/shared/design/checkerboard";
import { THUMBNAIL_SIDE, thumbnailBox } from "@/lib/shared/design/layers";
import { layerCanvas } from "@/lib/shared/design/raster-canvas";
import type { RasterStore } from "@/lib/shared/design/raster-store";

const REDRAW_DELAY_MS = 200;
const BACKDROP = checkerboard(8);

export function DesignLayerThumb({
  store,
  id,
  pixelWidth,
  pixelHeight,
}: {
  store: RasterStore;
  id: string;
  pixelWidth: number;
  pixelHeight: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(-1);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const draw = () => {
      timer = null;
      const target = ref.current;
      const source = layerCanvas(store, id);
      const context = target?.getContext("2d") ?? null;
      if (target === null || context === null || source === null) return;
      drawn.current = store.revisionOf(id);
      const box = thumbnailBox(pixelWidth, pixelHeight);
      context.clearRect(0, 0, THUMBNAIL_SIDE, THUMBNAIL_SIDE);
      context.drawImage(source, box.x, box.y, box.width, box.height);
    };
    const schedule = () => {
      if (timer !== null || store.revisionOf(id) === drawn.current) return;
      timer = setTimeout(draw, REDRAW_DELAY_MS);
    };
    draw();
    const unsubscribe = store.subscribe(schedule);
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [store, id, pixelWidth, pixelHeight]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      width={THUMBNAIL_SIDE}
      height={THUMBNAIL_SIDE}
      style={BACKDROP}
      className="size-8 shrink-0 rounded border"
    />
  );
}
