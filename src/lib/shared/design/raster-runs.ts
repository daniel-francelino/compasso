import { type InheritedLayer, isRasterStackKind } from "@/lib/shared/design/document";
import { DesignElementKind } from "@/lib/shared/design/types";

export type RasterRun = {
  startIndex: number;
  layers: InheritedLayer[];
  adjusted: boolean;
};

const endsRun = (layer: InheritedLayer): boolean =>
  !isRasterStackKind(layer.element) &&
  !layer.hidden &&
  layer.element.kind !== DesignElementKind.Group;

const isVisibleAdjustment = (layer: InheritedLayer): boolean =>
  layer.element.kind === DesignElementKind.Adjustment && !layer.hidden;

export const splitRasterRuns = (layers: readonly InheritedLayer[]): RasterRun[] => {
  const runs: RasterRun[] = [];
  let current: RasterRun | null = null;
  for (const [index, layer] of layers.entries()) {
    if (endsRun(layer)) current = null;
    if (!isRasterStackKind(layer.element)) continue;
    current ??= { startIndex: index, layers: [], adjusted: false };
    if (current.layers.length === 0) runs.push(current);
    current.layers.push(layer);
    current.adjusted = current.adjusted || isVisibleAdjustment(layer);
  }
  return runs;
};
