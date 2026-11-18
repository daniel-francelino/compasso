import { describe, expect, it } from "vitest";
import {
  type InheritedLayer,
  createRasterLayer,
  createText,
  emptyPage,
} from "@/lib/shared/design/document";
import { AdjustmentType } from "@/lib/shared/design/raster/adjustment-types";
import { defaultAdjustment } from "@/lib/shared/design/raster/adjustments";
import { splitRasterRuns } from "@/lib/shared/design/raster-runs";
import { DesignElementKind, DesignPreset } from "@/lib/shared/design/types";

const SIZE = { width: 100, height: 100 };
const PALETTE = { ink: "#111111", surface: "#eeeeee", accent: "#ff0000" };
const page = emptyPage("page-1");

const raster = (id: string, hidden = false): InheritedLayer => ({
  element: createRasterLayer(id, page, SIZE),
  hidden,
  opacity: 1,
});

const adjustment = (id: string, hidden = false): InheritedLayer => ({
  element: {
    ...createRasterLayer(id, page, SIZE),
    kind: DesignElementKind.Adjustment,
    adjustment: defaultAdjustment(AdjustmentType.BrightnessContrast),
  },
  hidden,
  opacity: 1,
});

const text = (id: string, hidden = false): InheritedLayer => ({
  element: createText(id, DesignPreset.FeedSquare, PALETTE),
  hidden,
  opacity: 1,
});

const group = (id: string): InheritedLayer => ({
  element: {
    ...createRasterLayer(id, page, SIZE),
    kind: DesignElementKind.Group,
    collapsed: false,
    passThrough: false,
  },
  hidden: false,
  opacity: 1,
});

const ids = (layers: readonly InheritedLayer[]) => layers.map((layer) => layer.element.id);

describe("splitRasterRuns", () => {
  it("splits at visible vector layers and keeps the run position", () => {
    const runs = splitRasterRuns([raster("a"), adjustment("j"), text("t"), raster("b")]);
    expect(runs.map((run) => [run.startIndex, ids(run.layers), run.adjusted])).toEqual([
      [0, ["a", "j"], true],
      [3, ["b"], false],
    ]);
  });

  it("ignores hidden vector layers and groups between pixel layers", () => {
    const runs = splitRasterRuns([raster("a"), text("t", true), group("g"), raster("b")]);
    expect(runs).toHaveLength(1);
    expect(ids(runs[0]?.layers ?? [])).toEqual(["a", "b"]);
  });

  it("does not mark a run adjusted when its adjustment is hidden", () => {
    const runs = splitRasterRuns([raster("a"), adjustment("j", true)]);
    expect(runs[0]?.adjusted).toBe(false);
  });

  it("returns no runs without pixel layers", () => {
    expect(splitRasterRuns([text("t")])).toEqual([]);
  });

  it("marks a run that clips a layer to the one below as composited", () => {
    const clipped = raster("b");
    clipped.element = { ...clipped.element, clipToBelow: true };
    expect(splitRasterRuns([raster("a"), clipped])[0]?.adjusted).toBe(true);
    expect(splitRasterRuns([raster("a"), raster("b")])[0]?.adjusted).toBe(false);
  });
});
