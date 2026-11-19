import { describe, expect, it } from "vitest";
import { emptyDocument, emptyPage } from "@/lib/shared/design/document";
import { pushHistory, historyOf } from "@/lib/shared/design/history";
import {
  clampPaint,
  createPath,
  defaultPathStroke,
  gradientCss,
  patchPath,
  pathDash,
  pathPaintProps,
  safePathData,
  solidPaint,
  sortedStops,
  stopColor,
} from "@/lib/shared/design/path";
import type { DesignPage, PathElement } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignPathPaintKind } from "@/lib/shared/design/types";

const PAGE = { width: 1000, height: 1000 };
const RED = "#ff0000";
const stop = (offset: number, color = RED, alpha = 1) => ({ offset, color, alpha });

const make = (patch: Partial<PathElement> = {}): PathElement => ({
  ...createPath({ id: "p1", d: "M0 0L100 0L100 50Z", width: 100, height: 50 }, PAGE),
  ...patch,
});

const pageOf = (element: PathElement): DesignPage => ({
  ...emptyPage("pg"),
  elements: [element],
});
const first = (page: DesignPage) => page.elements[0] as PathElement;

describe("stops and css", () => {
  it("sorts stops and writes rgba from hex and alpha", () => {
    expect(sortedStops([stop(1), stop(0.2)]).map((item) => item.offset)).toEqual([0.2, 1]);
    expect(stopColor(stop(0, "#0a141e", 0.5))).toBe("rgba(10, 20, 30, 0.5)");
    expect(gradientCss([stop(1, RED, 0), stop(0, RED, 1)])).toBe(
      "linear-gradient(to right, rgba(255, 0, 0, 1) 0%, rgba(255, 0, 0, 0) 100%)",
    );
  });
});

describe("pathPaintProps", () => {
  it("converts fractions to view units", () => {
    const linear = make({
      viewWidth: 200,
      viewHeight: 100,
      fill: {
        kind: DesignPathPaintKind.Linear,
        x1: 0,
        y1: 0.5,
        x2: 1,
        y2: 0.5,
        stops: [stop(1), stop(0)],
      },
    });
    expect(pathPaintProps(linear)).toMatchObject({
      kind: "linear",
      start: [0, 50],
      end: [200, 50],
    });
    const radial = make({
      viewWidth: 200,
      viewHeight: 100,
      fill: {
        kind: DesignPathPaintKind.Radial,
        cx: 0.5,
        cy: 0.5,
        r: 0.5,
        stops: [stop(0), stop(1)],
      },
    });
    expect(pathPaintProps(radial)).toMatchObject({ kind: "radial", center: [100, 50], radius: 50 });
    expect(pathPaintProps(make({ fill: null }))).toBeNull();
  });

  it("dashes by stroke width", () => {
    expect(pathDash({ ...defaultPathStroke(RED), width: 2, dashed: true })).toEqual([6, 4]);
    expect(pathDash(defaultPathStroke(RED))).toEqual([]);
  });
});

describe("safePathData guard", () => {
  it("returns normalized data for valid input", () => {
    expect(safePathData("M0 0L10 10Z")).toBe("M0 0L10 10Z");
  });

  it("renders nothing and does not throw for 1e999 or garbage", () => {
    expect(() => safePathData("M0 0L1e999 5Z")).not.toThrow();
    expect(safePathData("M0 0L1e999 5Z")).toBeNull();
    expect(safePathData("M0 0L99999999 5Z")).toBeNull();
    expect(safePathData("<script>")).toBeNull();
    expect(safePathData("")).toBeNull();
  });
});

describe("patchPath", () => {
  it("clamps stroke width and miter limit", () => {
    const page = patchPath(pageOf(make()), "p1", {
      stroke: { ...defaultPathStroke(RED), width: 9999, miterLimit: 0 },
    });
    expect(first(page).stroke?.width).toBe(DESIGN_LIMITS.maxPathStrokeWidth);
    expect(first(page).stroke?.miterLimit).toBe(DESIGN_LIMITS.minMiterLimit);
    const low = patchPath(page, "p1", { stroke: { ...defaultPathStroke(RED), width: 0 } });
    expect(first(low).stroke?.width).toBe(DESIGN_LIMITS.minPathStrokeWidth);
  });

  it("clamps stop offsets, alpha and count", () => {
    const many = Array.from({ length: 12 }, (_, index) => stop(index / 11));
    const paint = clampPaint({
      kind: DesignPathPaintKind.Linear,
      x1: -1,
      y1: 0,
      x2: 2,
      y2: 0,
      stops: [stop(-3, RED, 5), ...many],
    });
    expect(paint).toMatchObject({ x1: 0, x2: 1 });
    if (paint === null || paint.kind === DesignPathPaintKind.Solid) throw new Error("kind");
    expect(paint.stops).toHaveLength(DESIGN_LIMITS.maxGradientStops);
    expect(paint.stops[0]).toMatchObject({ offset: 0, alpha: 1 });
  });

  it("rejects fewer than the minimum stops and bad colors, keeping the old value", () => {
    const base = make({ fill: solidPaint(RED) });
    const fewer = patchPath(pageOf(base), "p1", {
      fill: { kind: DesignPathPaintKind.Radial, cx: 0.5, cy: 0.5, r: 0.5, stops: [stop(0)] },
    });
    expect(first(fewer).fill).toEqual(solidPaint(RED));
    const bad = patchPath(pageOf(base), "p1", { fill: solidPaint("nope") });
    expect(first(bad).fill).toEqual(solidPaint(RED));
  });

  it("null removes fill and stroke; fillRule applies; other kinds untouched", () => {
    const page = patchPath(pageOf(make({ fill: solidPaint(RED) })), "p1", {
      fill: null,
      stroke: null,
      fillRule: "evenodd",
    });
    expect(first(page)).toMatchObject({ fill: null, stroke: null, fillRule: "evenodd" });
    expect(patchPath(page, "missing", { fill: null })).toEqual(page);
  });

  it("merges consecutive history steps with the same key only", () => {
    const base = emptyDocument();
    const start = historyOf({
      ...base,
      pages: [pageOf(make({ stroke: defaultPathStroke(RED) }))],
    });
    const change = (width: number, key: string | null, history: typeof start) =>
      pushHistory(
        history,
        {
          ...history.present,
          pages: history.present.pages.map((page) =>
            patchPath(page, "p1", { stroke: { ...defaultPathStroke(RED), width } }),
          ),
        },
        DESIGN_LIMITS.history,
        key,
      );
    const merged = change(3, "pathStrokeWidth:p1", change(2, "pathStrokeWidth:p1", start));
    expect(merged.past).toHaveLength(1);
    const split = change(3, null, change(2, null, start));
    expect(split.past).toHaveLength(2);
  });
});
