import { describe, expect, it } from "vitest";
import {
  beginStroke,
  finishStroke,
  stampDab,
  type BrushParams,
} from "@/lib/shared/design/raster/brush";
import {
  clonePixelBuffer,
  createPixelBuffer,
  type PixelBuffer,
} from "@/lib/shared/design/raster/pixel-buffer";
import {
  DEFAULT_PIXEL_HISTORY_BUDGET_BYTES,
  MAX_PIXEL_HISTORY_STEPS,
  applyPatch,
  createPixelHistory,
  recordStroke,
  revertPatch,
  type PixelPatch,
} from "@/lib/shared/design/raster/pixel-history";
import { snapshotTile, tilesEqual, type TileData } from "@/lib/shared/design/raster/tiles";

const brush: BrushParams = {
  size: 30,
  hardness: 0.5,
  opacity: 1,
  flow: 1,
  color: { r: 200, g: 40, b: 90 },
  erase: false,
};

const paint = (buffer: PixelBuffer, x: number, y: number): PixelPatch => {
  const stroke = beginStroke(buffer);
  stampDab(buffer, x, y, brush, stroke);
  stampDab(buffer, x + 20, y + 5, brush, stroke);
  return finishStroke(stroke);
};

const fake = (bytes: number): PixelPatch => ({
  tiles: [
    {
      key: 0,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      before: new Uint8ClampedArray(bytes / 2),
      after: new Uint8ClampedArray(bytes / 2),
    },
  ],
  bytes,
});

describe("patches", () => {
  it("applies and reverts exactly across tile borders", () => {
    const buffer = createPixelBuffer(600, 300);
    const original = clonePixelBuffer(buffer);
    const patch = paint(buffer, 250, 140);
    const painted = clonePixelBuffer(buffer);
    expect(patch.tiles.length).toBe(2);
    expect(patch.bytes).toBe(patch.tiles.reduce((n, t) => n + t.before.length + t.after.length, 0));
    revertPatch(buffer, patch);
    expect(tilesEqual(buffer.data, original.data)).toBe(true);
    applyPatch(buffer, patch);
    expect(tilesEqual(buffer.data, painted.data)).toBe(true);
  });

  it("drops tiles that were snapshotted but not changed", () => {
    const buffer = createPixelBuffer(300, 300);
    const store = new Map<number, TileData>();
    snapshotTile(buffer, store, 0, 0);
    expect(recordStroke(store, buffer)).toEqual({ tiles: [], bytes: 0 });
  });
});

describe("PixelHistory", () => {
  it("has the decided defaults", () => {
    expect(DEFAULT_PIXEL_HISTORY_BUDGET_BYTES).toBe(256 * 1024 * 1024);
    expect(MAX_PIXEL_HISTORY_STEPS).toBe(100);
  });

  it("undoes and redoes real strokes exactly with step names", () => {
    const buffer = createPixelBuffer(600, 300);
    const blank = clonePixelBuffer(buffer);
    const history = createPixelHistory();
    const resolve = (id: string) => (id === "layer" ? buffer : null);
    history.push("Pincel", "layer", paint(buffer, 100, 100));
    const afterFirst = clonePixelBuffer(buffer);
    history.push("Borracha", "layer", paint(buffer, 300, 200));
    const afterSecond = clonePixelBuffer(buffer);
    expect(history.steps().map((step) => step.label)).toEqual(["Pincel", "Borracha"]);
    expect(history.undo(resolve)).toBe("Borracha");
    expect(tilesEqual(buffer.data, afterFirst.data)).toBe(true);
    expect(history.undo(resolve)).toBe("Pincel");
    expect(tilesEqual(buffer.data, blank.data)).toBe(true);
    expect(history.undo(resolve)).toBeNull();
    expect(history.redo(resolve)).toBe("Pincel");
    expect(history.redo(resolve)).toBe("Borracha");
    expect(tilesEqual(buffer.data, afterSecond.data)).toBe(true);
    expect(history.redo(resolve)).toBeNull();
  });

  it("does not move when the target cannot be resolved", () => {
    const history = createPixelHistory();
    history.push("A", "gone", fake(10));
    expect(history.undo(() => null)).toBeNull();
    expect(history.canUndo()).toBe(true);
    expect(history.steps()[0]?.applied).toBe(true);
  });

  it("evicts the oldest steps first when over the byte budget", () => {
    const history = createPixelHistory({ budgetBytes: 100 });
    expect(history.push("one", "t", fake(40))).toBe(0);
    expect(history.push("two", "t", fake(40))).toBe(0);
    expect(history.bytes()).toBe(80);
    expect(history.push("three", "t", fake(40))).toBe(1);
    expect(history.steps().map((step) => step.label)).toEqual(["two", "three"]);
    expect(history.bytes()).toBe(80);
    expect(history.push("four", "t", fake(90))).toBe(2);
    expect(history.steps().map((step) => step.label)).toEqual(["four"]);
    expect(history.bytes()).toBe(90);
  });

  it("keeps a single step even when it alone exceeds the budget", () => {
    const history = createPixelHistory({ budgetBytes: 10 });
    history.push("big", "t", fake(50));
    expect(history.size()).toBe(1);
    expect(history.canUndo()).toBe(true);
  });

  it("caps the number of steps at 100", () => {
    const history = createPixelHistory();
    for (let i = 1; i <= 105; i += 1) history.push(`step ${i}`, "t", fake(2));
    expect(history.size()).toBe(100);
    expect(history.steps()[0]?.label).toBe("step 6");
    expect(history.bytes()).toBe(200);
  });

  it("drops the redo steps when a new one is pushed and accounts their bytes", () => {
    const buffer = createPixelBuffer(10, 10);
    const history = createPixelHistory();
    const resolve = () => buffer;
    history.push("A", "t", fake(10));
    history.push("B", "t", fake(20));
    history.push("C", "t", fake(30));
    history.undo(resolve);
    history.undo(resolve);
    expect(history.canRedo()).toBe(true);
    history.push("D", "t", fake(5));
    expect(history.steps().map((step) => step.label)).toEqual(["A", "D"]);
    expect(history.canRedo()).toBe(false);
    expect(history.bytes()).toBe(15);
  });

  it("clears everything", () => {
    const history = createPixelHistory();
    history.push("A", "t", fake(10));
    history.clear();
    expect([history.size(), history.bytes(), history.canUndo()]).toEqual([0, 0, false]);
  });
});
