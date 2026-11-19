import { describe, expect, it } from "vitest";
import { emptyDocument } from "@/lib/shared/design/document";
import { createPath, defaultPathStroke, solidPaint } from "@/lib/shared/design/path";
import { designDocumentSchema, pathElementSchema } from "@/lib/shared/design/schemas";
import {
  DESIGN_LIMITS,
  DesignElementKind,
  DesignPathFillRule,
  DesignPathPaintKind,
} from "@/lib/shared/design/types";

const PAGE = { width: 1080, height: 1080 };
const RED = "#aa0000";
const BLUE = "#0000aa";
const D = "M0 0L10 0L10 10Z";

const stop = (offset: number) => ({ offset, color: BLUE, alpha: 1 });
const stops = (count: number) =>
  Array.from({ length: count }, (_, index) => stop(index / Math.max(1, count - 1)));
const linear = (count: number) => ({
  kind: DesignPathPaintKind.Linear,
  x1: 0,
  y1: 0,
  x2: 1,
  y2: 1,
  stops: stops(count),
});

const pathWith = (patch: Record<string, unknown>) => ({
  ...createPath({ id: "p1", d: D, width: 10, height: 10 }, PAGE),
  ...patch,
});
const valid = (patch: Record<string, unknown> = {}) =>
  pathElementSchema.safeParse(pathWith(patch)).success;

const documentOf = (version: number, elements: object[]) => ({
  version,
  pages: [{ id: "p", background: null, elements }],
});

describe("document version 4 and the path element", () => {
  it("writes version 4 for an empty document", () => {
    expect(emptyDocument().version).toBe(4);
  });

  it("reads version 3 as version 4 without rewriting elements", () => {
    const rect = {
      id: "r",
      kind: DesignElementKind.Rect,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rotation: 0,
      opacity: 1,
      locked: false,
      fill: RED,
      cornerRadius: 0,
    };
    const parsed = designDocumentSchema.parse(documentOf(3, [rect]));
    expect(parsed.version).toBe(4);
    expect(parsed.pages[0]?.elements[0]).toMatchObject({ id: "r", kind: "rect", fill: RED });
  });

  it("refuses a path element inside a version 3 document", () => {
    expect(designDocumentSchema.safeParse(documentOf(3, [pathWith({})])).success).toBe(false);
    expect(designDocumentSchema.safeParse(documentOf(4, [pathWith({})])).success).toBe(true);
  });

  it("reads versions 1 and 2 as version 4", () => {
    const v1 = designDocumentSchema.parse({ version: 1, background: null, elements: [] });
    const v2 = designDocumentSchema.parse({
      version: 2,
      pages: [{ id: "p", background: null, elements: [] }],
    });
    expect([v1.version, v2.version]).toEqual([4, 4]);
  });

  it("creates a centered path with the defaults", () => {
    const path = createPath({ id: "p", d: D, width: 100, height: 40, fill: solidPaint(RED) }, PAGE);
    expect(path).toMatchObject({
      kind: DesignElementKind.Path,
      x: 490,
      y: 520,
      viewWidth: 100,
      viewHeight: 40,
      stroke: null,
      fillRule: DesignPathFillRule.NonZero,
    });
    expect(pathElementSchema.safeParse(path).success).toBe(true);
  });

  it("clamps the box size of a created path", () => {
    const path = createPath({ id: "p", d: D, width: 0, height: 99999 }, PAGE);
    expect(path.width).toBe(DESIGN_LIMITS.minSize);
    expect(path.height).toBe(DESIGN_LIMITS.maxSize);
  });

  it("validates the path data alphabet and length", () => {
    expect(valid({ d: "M0 0 C1,2 3,4 5e-1 6E+1Z" })).toBe(true);
    expect(valid({ d: "M0 0 A5 5 0 0 1 10 10" })).toBe(false);
    expect(valid({ d: "M0 0 h10" })).toBe(false);
    expect(valid({ d: "M0 0 <script>" })).toBe(false);
    expect(valid({ d: "" })).toBe(false);
    expect(valid({ d: `M${"1".repeat(DESIGN_LIMITS.maxPathData - 1)}` })).toBe(true);
    expect(valid({ d: `M${"1".repeat(DESIGN_LIMITS.maxPathData)}` })).toBe(false);
  });

  it("enforces the command count guard", () => {
    expect(valid({ d: "L1 1".repeat(DESIGN_LIMITS.maxPathCommands) })).toBe(true);
    expect(valid({ d: "L1 1".repeat(DESIGN_LIMITS.maxPathCommands + 1) })).toBe(false);
  });

  it("validates the view size", () => {
    expect(valid({ viewWidth: 0 })).toBe(false);
    expect(valid({ viewHeight: DESIGN_LIMITS.maxSize + 1 })).toBe(false);
  });

  it("accepts gradients with 2 to 8 stops and refuses 1 and 9", () => {
    expect(valid({ fill: linear(DESIGN_LIMITS.minGradientStops) })).toBe(true);
    expect(valid({ fill: linear(DESIGN_LIMITS.maxGradientStops) })).toBe(true);
    expect(valid({ fill: linear(1) })).toBe(false);
    expect(valid({ fill: linear(DESIGN_LIMITS.maxGradientStops + 1) })).toBe(false);
    const radial = { kind: DesignPathPaintKind.Radial, cx: 0.5, cy: 0.5, r: 0.5, stops: stops(2) };
    expect(valid({ fill: radial })).toBe(true);
    expect(valid({ fill: { ...radial, r: 0 } })).toBe(false);
    expect(valid({ fill: { ...radial, stops: stops(9) } })).toBe(false);
  });

  it("refuses colors that are not #rrggbb", () => {
    expect(valid({ fill: solidPaint("red") })).toBe(false);
    expect(valid({ fill: solidPaint("#fff") })).toBe(false);
    expect(valid({ fill: solidPaint("#AA0000") })).toBe(false);
    expect(
      valid({ fill: { ...linear(2), stops: [stop(0), { ...stop(1), color: "#12345" }] } }),
    ).toBe(false);
    expect(valid({ stroke: defaultPathStroke("rgb(0,0,0)") })).toBe(false);
  });

  it("validates the stroke limits", () => {
    const stroke = defaultPathStroke(RED);
    const strokeWith = (patch: object) => valid({ stroke: { ...stroke, ...patch } });
    expect(strokeWith({})).toBe(true);
    expect(strokeWith({ width: DESIGN_LIMITS.minPathStrokeWidth })).toBe(true);
    expect(strokeWith({ width: DESIGN_LIMITS.minPathStrokeWidth / 2 })).toBe(false);
    expect(strokeWith({ width: DESIGN_LIMITS.maxPathStrokeWidth })).toBe(true);
    expect(strokeWith({ width: DESIGN_LIMITS.maxPathStrokeWidth + 1 })).toBe(false);
    expect(strokeWith({ miterLimit: DESIGN_LIMITS.maxMiterLimit + 1 })).toBe(false);
    expect(strokeWith({ miterLimit: DESIGN_LIMITS.minMiterLimit - 0.5 })).toBe(false);
    expect(strokeWith({ cap: "triangle" })).toBe(false);
    expect(strokeWith({ join: "arcs" })).toBe(false);
  });

  it("refuses an unknown fill rule and paint kind", () => {
    expect(valid({ fillRule: "winding" })).toBe(false);
    expect(valid({ fill: { kind: "pattern" } })).toBe(false);
  });
});
