import { describe, expect, it } from "vitest";
import { historyOf, pushHistory } from "@/lib/shared/design/history";
import { createPixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import { createPixelHistory } from "@/lib/shared/design/raster/pixel-history";
import { DEFAULT_BRUSH_OPTIONS, toBrushParams } from "@/lib/shared/design/paint";
import type { DesignDocument } from "@/lib/shared/design/schemas";
import { createStrokeSession } from "@/lib/shared/design/stroke-session";
import {
  markPixelStep,
  redoTimeline,
  timelineSteps,
  undoTimeline,
} from "@/lib/shared/design/timeline";

const doc = (name: string): DesignDocument => ({ version: 3, pages: [], name }) as never;

const RED = { r: 200, g: 20, b: 20 };

const setup = () => {
  const buffer = createPixelBuffer(64, 64);
  const pixels = createPixelHistory();
  const resolve = () => buffer;
  const steps = {
    undo: () => void pixels.undo(resolve),
    redo: () => void pixels.redo(resolve),
  };
  const stroke = (
    history: ReturnType<typeof historyOf<DesignDocument>>,
    x: number,
    label: string,
  ) => {
    const options = { ...DEFAULT_BRUSH_OPTIONS, size: 8 };
    const session = createStrokeSession(buffer, toBrushParams(options, RED, false), options);
    session.move([{ x, y: 32 }]);
    const patch = session.finish();
    if (patch === null) throw new Error("empty stroke");
    pixels.push(label, "layer", patch);
    return pushHistory(history, markPixelStep(history.present, label), 100);
  };
  const alpha = (x: number) => buffer.data[(32 * 64 + x) * 4 + 3] ?? 0;
  return { stroke, steps, alpha };
};

describe("unified timeline", () => {
  it("undoes and redoes strokes in order with document steps", () => {
    const { stroke, steps, alpha } = setup();
    let history = historyOf(doc("a"));
    history = stroke(history, 10, "Pincel");
    history = pushHistory(history, doc("b"), 100);
    history = stroke(history, 40, "Borracha");
    expect(timelineSteps(history).map((step) => step.label)).toEqual([
      "Pincel",
      "Alteração",
      "Borracha",
    ]);
    expect(alpha(40)).toBeGreaterThan(0);
    history = undoTimeline(history, steps);
    expect(alpha(40)).toBe(0);
    expect(alpha(10)).toBeGreaterThan(0);
    history = undoTimeline(history, steps);
    expect(alpha(10)).toBeGreaterThan(0);
    history = undoTimeline(history, steps);
    expect(alpha(10)).toBe(0);
    history = redoTimeline(history, steps);
    expect(alpha(10)).toBeGreaterThan(0);
    history = redoTimeline(history, steps);
    history = redoTimeline(history, steps);
    expect(alpha(40)).toBeGreaterThan(0);
    expect(history.future).toHaveLength(0);
  });

  it("marks only the applied steps as applied", () => {
    const { stroke, steps } = setup();
    let history = stroke(historyOf(doc("a")), 10, "Pincel");
    history = undoTimeline(history, steps);
    expect(timelineSteps(history)).toEqual([{ label: "Pincel", applied: false, pixels: true }]);
  });
});
