import { useEffect } from "react";
import type { PixelHistory } from "@/lib/shared/design/raster/pixel-history";
import type { RasterStore } from "@/lib/shared/design/raster-store";
import { unreferencedRasterIds } from "@/lib/shared/design/raster-references";
import type { DesignDocument } from "@/lib/shared/design/schemas";

export const RASTER_RELEASE_DELAY_MS = 1500;

export const useRasterRelease = (
  store: RasterStore,
  documents: readonly DesignDocument[],
  history: PixelHistory,
): void => {
  useEffect(() => {
    const timer = setTimeout(() => {
      const stepIds = history.steps().map((step) => step.targetId);
      for (const id of unreferencedRasterIds(documents, stepIds, store.ids())) store.release(id);
    }, RASTER_RELEASE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [documents, history, store]);
};
