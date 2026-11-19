import { describe, expect, it, vi } from "vitest";
import { encodeText } from "@/lib/shared/design/import/handlers/svg-fixtures";
import {
  type SvgImportDeps,
  decodeSvgVector,
  svgVectorHandler,
} from "@/lib/shared/design/import/handlers/svg-import";
import {
  buildPathElements,
  canMerge,
  mergeShapes,
} from "@/lib/shared/design/import/handlers/svg-vector-build";
import { parseSvgVector } from "@/lib/shared/design/import/handlers/svg-vector";
import { ICON, wrap } from "@/lib/shared/design/import/handlers/svg-vector-fixtures";
import {
  type SvgVectorShape,
  SvgFallback,
  svgFailure,
} from "@/lib/shared/design/import/handlers/svg-vector-types";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { IMPORT_HANDLERS } from "@/lib/shared/design/import/registry";
import {
  DesignImportFormat,
  DesignImportKind,
  DesignImportNoteKind,
  type ImportInput,
  type ImportKindResult,
} from "@/lib/shared/design/import/types";
import type { PathPaint, PathStroke } from "@/lib/shared/design/schemas";
import {
  DESIGN_LIMITS,
  DesignPathCap,
  DesignPathFillRule,
  DesignPathJoin,
  DesignPathPaintKind,
} from "@/lib/shared/design/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const RASTER: Result<ImportKindResult> = {
  ok: true,
  kind: DesignImportKind.Image,
  design: {
    format: DesignImportFormat.Svg,
    width: 64,
    height: 64,
    elements: [],
    buffers: new Map(),
    notes: [{ kind: DesignImportNoteKind.VectorRasterized, count: 1 }],
    metadata: null,
  },
};

const counter = (): (() => string) => {
  let next = 0;
  return () => {
    next += 1;
    return `p${next}`;
  };
};

const inputOf = (text: string, overrides: Partial<ImportInput> = {}): ImportInput => ({
  file: new File([text], "Logo.svg"),
  bytes: encodeText(text),
  capacityElements: DESIGN_LIMITS.maxElements,
  usedBytes: 0,
  newId: counter(),
  ...overrides,
});

const depsOf = (overrides: Partial<SvgImportDeps> = {}): SvgImportDeps => ({
  parse: (bytes) => parseSvgVector(bytes),
  raster: vi.fn(async () => RASTER),
  ...overrides,
});

const solid = (digits: string): PathPaint => ({
  kind: DesignPathPaintKind.Solid,
  color: `#${digits}`,
});

const STROKE: PathStroke = {
  color: `#${"000000"}`,
  width: 1,
  cap: DesignPathCap.Butt,
  join: DesignPathJoin.Miter,
  miterLimit: 4,
  dashed: false,
};

const shape = (overrides: Partial<SvgVectorShape> = {}): SvgVectorShape => ({
  name: null,
  d: "M0 0L10 0L10 10Z",
  commandCount: 4,
  fill: solid("ff0000"),
  stroke: null,
  fillRule: DesignPathFillRule.NonZero,
  opacity: 1,
  bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  ...overrides,
});

const digitsOf = (index: number): string => `${(index + 1).toString(16).padStart(2, "0")}0000`;

const squares = (count: number): string =>
  Array.from(
    { length: count },
    (_, index) => `<rect x="${index}" y="0" width="1" height="1" fill="#${digitsOf(index)}"/>`,
  ).join("");

describe("decodeSvgVector", () => {
  it("returns a document of path elements for a simple icon", async () => {
    const deps = depsOf();
    const result = await decodeSvgVector(inputOf(ICON), deps);
    expect(result.ok && result.kind).toBe(DesignImportKind.Document);
    if (!result.ok) return;
    expect(result.design.notes).toEqual([]);
    expect(result.design.buffers.size).toBe(0);
    expect(result.design.elements.length).toBeGreaterThan(0);
    for (const element of result.design.elements) expect(element.kind).toBe("path");
    expect(deps.raster).not.toHaveBeenCalled();
  });

  it.each([
    [SvgFallback.Unsupported],
    [SvgFallback.Malformed],
    [SvgFallback.ParseLimit],
    [SvgFallback.TooLarge],
  ])("falls back to raster with the rasterized note alone for %s", async (reason) => {
    const deps = depsOf({ parse: () => svgFailure(reason) });
    const result = await decodeSvgVector(inputOf(ICON), deps);
    expect(result).toBe(RASTER);
    expect(deps.raster).toHaveBeenCalledTimes(1);
  });

  it("adds the limit note to the raster fallback for svg_vector_limit", async () => {
    const deps = depsOf({ parse: () => svgFailure(SvgFallback.VectorLimit) });
    const result = await decodeSvgVector(inputOf(ICON), deps);
    expect(result.ok && result.design.notes.map((note) => note.kind)).toEqual([
      DesignImportNoteKind.VectorRasterized,
      DesignImportNoteKind.VectorLimitReached,
    ]);
  });

  it("keeps a raster failure when the limit fallback itself fails", async () => {
    const failed: Result<ImportKindResult> = invalid("x");
    const deps = depsOf({
      parse: () => svgFailure(SvgFallback.VectorLimit),
      raster: async () => failed,
    });
    expect(await decodeSvgVector(inputOf(ICON), deps)).toBe(failed);
  });

  it("refuses on the time budget and never falls back", async () => {
    const deps = depsOf({ parse: () => svgFailure(SvgFallback.Timeout) });
    const result = await decodeSvgVector(inputOf(ICON), deps);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toBe(DESIGN_IMPORT_MESSAGE.svgVectorTimeout);
    expect(deps.raster).not.toHaveBeenCalled();
  });

  it("falls back for a feature outside the subset", async () => {
    const deps = depsOf();
    const text = wrap('<rect width="4" height="4" filter="url(#f)"/>');
    expect(await decodeSvgVector(inputOf(text), deps)).toBe(RASTER);
  });

  it("falls back whole, never partial, when the shapes exceed the capacity", async () => {
    const deps = depsOf();
    const result = await decodeSvgVector(inputOf(wrap(squares(3)), { capacityElements: 2 }), deps);
    expect(result.ok && result.kind).toBe(DesignImportKind.Image);
    expect(result.ok && result.design.notes.map((note) => note.kind)).toContain(
      DesignImportNoteKind.VectorLimitReached,
    );
    expect(result.ok && result.design.elements).toEqual([]);
  });

  it("imports the same file when the capacity is enough", async () => {
    const result = await decodeSvgVector(
      inputOf(wrap(squares(3)), { capacityElements: 3 }),
      depsOf(),
    );
    expect(result.ok && result.design.elements).toHaveLength(3);
  });

  it("falls back whole when the candidate document would pass the size cap", async () => {
    const deps = depsOf();
    const result = await decodeSvgVector(
      inputOf(wrap(squares(2)), { documentBytes: DESIGN_LIMITS.maxBytes - 10 }),
      deps,
    );
    expect(result.ok && result.kind).toBe(DesignImportKind.Image);
    expect(deps.raster).toHaveBeenCalledTimes(1);
  });

  it("fits the artwork inside the given page and centers it", async () => {
    const text = wrap('<rect width="400" height="200" fill="red"/>', 'width="400" height="200"');
    const result = await decodeSvgVector(
      inputOf(text, { page: { width: 100, height: 100 } }),
      depsOf(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [element] = result.design.elements;
    expect(result.design.width).toBe(100);
    expect(element?.width).toBe(80);
    expect(element?.height).toBe(40);
    expect(element?.x).toBe(10);
    expect(element?.y).toBe(30);
  });

  it("gives a horizontal line a height of 1 and scales its stroke", async () => {
    const text = wrap('<path d="M2 12H22" fill="none" stroke="blue" stroke-width="2"/>');
    const result = await decodeSvgVector(
      inputOf(text, { page: { width: 24, height: 24 } }),
      depsOf(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [element] = result.design.elements;
    expect(element?.kind).toBe("path");
    expect(element?.height).toBe(1);
    expect(element?.width).toBe(16);
    expect(element?.kind === "path" && element.stroke?.width).toBeCloseTo((2 * 19) / 24, 3);
  });

  it("stops before any work when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const deps = depsOf();
    const result = await decodeSvgVector(inputOf(ICON, { signal: controller.signal }), deps);
    expect(result.ok).toBe(false);
    expect(deps.raster).not.toHaveBeenCalled();
  });
});

describe("mergeShapes", () => {
  it("merges consecutive shapes with the same solid paint", () => {
    const second = shape({
      d: "M20 0L30 0L30 10Z",
      bounds: { minX: 20, minY: 0, maxX: 30, maxY: 10 },
    });
    const third = shape({ bounds: { minX: 40, minY: 0, maxX: 50, maxY: 10 } });
    const merged = mergeShapes([shape(), second, third]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.commandCount).toBe(12);
  });

  it("does not merge across a different color, stroke, opacity or fill rule", () => {
    expect(canMerge(shape(), shape({ fill: solid("00ff00") }))).toBe(false);
    expect(canMerge(shape(), shape({ opacity: 0.5 }))).toBe(false);
    expect(canMerge(shape(), shape({ fillRule: DesignPathFillRule.EvenOdd }))).toBe(false);
    expect(canMerge(shape({ stroke: STROKE }), shape({ stroke: { ...STROKE, width: 2 } }))).toBe(
      false,
    );
  });

  it("never merges gradients", () => {
    const gradient: PathPaint = {
      kind: DesignPathPaintKind.Linear,
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      stops: [
        { offset: 0, color: `#${"000000"}`, alpha: 1 },
        { offset: 1, color: `#${"ffffff"}`, alpha: 1 },
      ],
    };
    expect(canMerge(shape({ fill: gradient }), shape({ fill: gradient }))).toBe(false);
  });

  it("keeps overlapping same-paint shapes apart and merges disjoint ones", () => {
    const near = { bounds: { minX: 5, minY: 5, maxX: 15, maxY: 15 } };
    const far = { bounds: { minX: 50, minY: 50, maxX: 60, maxY: 60 } };
    expect(canMerge(shape(), shape(near))).toBe(false);
    expect(mergeShapes([shape(), shape(near)])).toHaveLength(2);
    expect(canMerge(shape(), shape(far))).toBe(true);
    const evenOdd = { fillRule: DesignPathFillRule.EvenOdd };
    expect(canMerge(shape(evenOdd), shape({ ...evenOdd, ...far }))).toBe(true);
    expect(canMerge(shape({ opacity: 0.5 }), shape({ opacity: 0.5, ...far }))).toBe(true);
  });

  it("starts a new element when the merged data would pass the path caps", () => {
    const long = shape({ d: `M0 0${"L1 1".repeat(2500)}`, commandCount: 2501 });
    const far = { bounds: { minX: 50, minY: 50, maxX: 60, maxY: 60 } };
    expect(mergeShapes([long, { ...long, ...far }])).toHaveLength(2);
  });
});

describe("buildPathElements", () => {
  it("falls back when the total path data passes the import byte cap", () => {
    const body = `M0 0${"L1 1".repeat(2900)}`;
    const shapes = Array.from({ length: 12 }, (_, index) =>
      shape({ d: body, commandCount: 2901, fill: solid(digitsOf(index)) }),
    );
    const result = buildPathElements(
      { width: 100, height: 100, shapes, dataBytes: 0 },
      {
        page: { width: 4000, height: 4000 },
        capacityElements: 200,
        documentBytes: 0,
        newId: counter(),
      },
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe(SvgFallback.VectorLimit);
  });

  it("rounds a zero extent to 1", () => {
    const line = shape({
      d: "M0 5L10 5",
      commandCount: 2,
      fill: null,
      stroke: STROKE,
      bounds: { minX: 0, minY: 5, maxX: 10, maxY: 5 },
    });
    const result = buildPathElements(
      { width: 10, height: 10, shapes: [line], dataBytes: 0 },
      {
        page: { width: 100, height: 100 },
        capacityElements: 5,
        documentBytes: 0,
        newId: counter(),
      },
    );
    expect(result.ok && result.elements).toHaveLength(1);
    expect(result.ok && result.elements[0]?.height).toBe(1);
  });
});

describe("gradient and registry rules of item 5-7", () => {
  it("falls back for a radial gradient on a non-square box", () => {
    const text = wrap(
      '<defs><radialGradient id="r" gradientUnits="userSpaceOnUse" cx="10" cy="5" r="5"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient></defs><rect width="20" height="10" fill="url(#r)"/>',
    );
    const result = parseSvgVector(text);
    expect(!result.ok && result.reason).toBe(SvgFallback.Unsupported);
  });

  it("registers the vector handler for svg as a document handler on the main thread", () => {
    const handler = IMPORT_HANDLERS.find((candidate) => candidate.format === "svg");
    expect(handler).toBe(svgVectorHandler);
    expect(svgVectorHandler.kind).toBe(DesignImportKind.Document);
    expect(svgVectorHandler.runsIn).toBe("main");
  });
});
