import { describe, expect, it } from "vitest";
import { rotate, scale, translate } from "@/lib/shared/design/vector/matrix";
import {
  type PathCommand,
  type PathLimits,
  PathFailure,
  mergePaths,
  normalizePathData,
  parsePathData,
  pathBounds,
  readNormalizedPath,
  serializePath,
  toBoxLocal,
  transformPath,
  validatePathData,
} from "@/lib/shared/design/vector/path-data";

const limits: PathLimits = { maxData: 16384, maxCommands: 3000 };

const normalize = (source: string, use: PathLimits = limits): string => {
  const result = normalizePathData(source, use);
  if (!result.ok) throw new Error(`unexpected failure: ${result.message}`);
  return result.d;
};

const failureOf = (source: string, use: PathLimits = limits): string => {
  const result = parsePathData(source, use);
  return result.ok ? "ok" : result.message;
};

const boundsOf = (source: string): { minX: number; minY: number; maxX: number; maxY: number } => {
  const parsed = parsePathData(source, limits);
  if (!parsed.ok) throw new Error(parsed.message);
  const bounds = pathBounds(parsed.commands);
  if (!bounds.ok) throw new Error(bounds.message);
  return bounds.bounds;
};

describe("path normalizer", () => {
  it("turns relative and H V commands into absolute L", () => {
    expect(normalize("m10 10 h5 v5 h-5 z")).toBe("M10 10L15 10L15 15L10 15Z");
    expect(normalize("M10 10 H20 V30 H5 Z")).toBe("M10 10L20 10L20 30L5 30Z");
  });

  it("expands S reflecting the previous cubic control point", () => {
    expect(normalize("M0 0 C10 0 20 10 20 20 s10 10 20 0")).toBe(
      "M0 0C10 0 20 10 20 20C20 30 30 30 40 20",
    );
    expect(normalize("M0 0 S10 10 20 0")).toBe("M0 0C0 0 10 10 20 0");
  });

  it("expands T reflecting the previous quadratic control point", () => {
    expect(normalize("M0 0 Q10 10 20 0 t20 0")).toBe("M0 0Q10 10 20 0Q30 -10 40 0");
    expect(normalize("M0 0 T20 0")).toBe("M0 0Q0 0 20 0");
  });

  it("does not reflect across a different command kind", () => {
    expect(normalize("M0 0 Q10 10 20 0 S30 30 40 0")).toBe("M0 0Q10 10 20 0C20 0 30 30 40 0");
    expect(normalize("M0 0 C1 1 2 2 3 3 T6 6")).toBe("M0 0C1 1 2 2 3 3Q3 3 6 6");
  });

  it("handles implicit repeats, compact numbers and separators", () => {
    expect(normalize("M0 0 10 10 20 0")).toBe("M0 0L10 10L20 0");
    expect(normalize("m1,1 2,2 3,3")).toBe("M1 1L3 3L6 6");
    expect(normalize("M0-1L.5.5-1e1-1E-1")).toBe("M0 -1L0.5 0.5L-10 -0.1");
    expect(normalize("  M0 0\n\tL1 1  ")).toBe("M0 0L1 1");
  });

  it("continues from the subpath start after Z", () => {
    expect(normalize("M5 5 L10 5 L10 10 Z l3 0")).toBe("M5 5L10 5L10 10ZM5 5L8 5");
    expect(normalize("M5 5 L6 6 Z Z")).toBe("M5 5L6 6Z");
  });

  it("drops subpaths that draw nothing", () => {
    expect(normalize("M1 1 M2 2 L3 3 M9 9 Z")).toBe("M2 2L3 3");
    expect(failureOf("M1 1")).toBe(PathFailure.Empty);
    expect(failureOf("M1 1 Z")).toBe(PathFailure.Empty);
    expect(failureOf("")).toBe(PathFailure.Empty);
  });

  it("rewrites -0 and tiny values as plain fixed precision text", () => {
    expect(normalize("M-0 -0 L-0 5")).toBe("M0 0L0 5");
    expect(normalize("M0 0 L1e-7 0.0004")).toBe("M0 0L0 0");
    expect(normalize("M0 0 L0.12345 1.9996")).toBe("M0 0L0.123 2");
  });
});

describe("arcs", () => {
  const flagCases: [string, number, number][] = [
    ["0 0", 1.34, 0],
    ["0 1", 0, -1.34],
    ["1 0", 18.66, 0],
    ["1 1", 0, -18.66],
  ];

  it.each(flagCases)("converts the flags %s into the right circle arc", (flags, maxY, minY) => {
    const bounds = boundsOf(`M0 0 A10 10 0 ${flags} 10 0`);
    expect(bounds.maxY).toBeCloseTo(maxY, 1);
    expect(bounds.minY).toBeCloseTo(minY, 1);
  });

  it("keeps every generated joint on the circle", () => {
    const parsed = parsePathData("M0 0 A10 10 0 1 1 10 0", limits);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const ends = parsed.commands.flatMap((command) =>
      command.type === "C" ? [{ x: command.x, y: command.y }] : [],
    );
    for (const end of ends.slice(0, -1)) {
      expect(Math.hypot(end.x - 5, end.y + 8.660254)).toBeCloseTo(10, 4);
    }
    expect(ends.length).toBeGreaterThanOrEqual(3);
  });

  it("scales radii up when the endpoints are too far apart", () => {
    const bounds = boundsOf("M0 0 A1 1 0 0 1 10 0");
    expect(bounds.minY).toBeCloseTo(-5, 1);
  });

  it("honors the x axis rotation", () => {
    const flat = boundsOf("M-10 0 A10 5 0 0 1 10 0");
    expect(flat.minY).toBeCloseTo(-5, 1);
    const turned = boundsOf("M0 -10 A10 5 90 0 1 0 10");
    expect(turned.maxX).toBeCloseTo(5, 1);
  });

  it("turns zero radii into a line and coincident endpoints into nothing", () => {
    expect(normalize("M0 0 A0 5 0 1 1 10 10")).toBe("M0 0L10 10");
    expect(normalize("M0 0 A5 0 0 0 0 10 10")).toBe("M0 0L10 10");
    expect(normalize("M0 0 L5 5 A9 9 0 1 1 5 5 L9 9")).toBe("M0 0L5 5L9 9");
    expect(failureOf("M0 0 A9 9 0 1 1 0 0")).toBe(PathFailure.Empty);
  });

  it("accepts packed flags without separators and relative arcs", () => {
    expect(normalize("M0 0 a5 5 0 1110 0")).toBe(normalize("M0 0 A5 5 0 1 1 10 0"));
    expect(boundsOf("M10 10 a5 5 0 0 0 10 0").maxY).toBeCloseTo(15, 1);
  });

  it("rejects flags that are not 0 or 1", () => {
    expect(failureOf("M0 0 A5 5 0 2 1 10 0")).toBe(PathFailure.BadFlag);
    expect(failureOf("M0 0 A5 5 0 0 -1 10 0")).toBe(PathFailure.BadFlag);
  });
});

describe("hostile and truncated input", () => {
  it("rejects huge, non finite and non numeric values", () => {
    expect(failureOf("M0 0 L1e308 0")).toBe(PathFailure.OutOfRange);
    expect(failureOf("M0 0 L1e999 0")).toBe(PathFailure.BadNumber);
    expect(failureOf("M0 0 L-1e999 0")).toBe(PathFailure.BadNumber);
    expect(failureOf("M0 0 LNaN 0")).toBe(PathFailure.BadNumber);
    expect(failureOf("M0 0 LInfinity 0")).toBe(PathFailure.BadNumber);
    expect(failureOf("M0 0 L--1 0")).toBe(PathFailure.BadNumber);
    expect(failureOf("M0 0 l1e307 0 l1e307 0")).toBe(PathFailure.OutOfRange);
  });

  it("rejects unknown commands, bad starts and numbers after Z", () => {
    expect(failureOf("L1 1")).toBe(PathFailure.BadStart);
    expect(failureOf("5 5 L1 1")).toBe(PathFailure.BadStart);
    expect(failureOf("M0 0 X1 1")).toBe(PathFailure.BadCharacter);
    expect(failureOf("M0 0 L1 1 #")).toBe(PathFailure.BadCharacter);
    expect(failureOf("M0 0 L1 1 Z 5")).toBe(PathFailure.BadStructure);
  });

  it("rejects truncated data", () => {
    expect(failureOf("M0")).toBe(PathFailure.Truncated);
    expect(failureOf("M")).toBe(PathFailure.Truncated);
    expect(failureOf("M0 0 L10")).toBe(PathFailure.Truncated);
    expect(failureOf("M0 0 C1 2 3 4 5")).toBe(PathFailure.Truncated);
    expect(failureOf("M0 0 A5 5 0 1")).toBe(PathFailure.Truncated);
    expect(failureOf("M0 0 L1 1,")).toBe(PathFailure.BadStructure);
    expect(failureOf("M0 0 L1 1, Z")).toBe(PathFailure.BadStructure);
    expect(failureOf("M0 0 L1")).toBe(PathFailure.Truncated);
  });

  it("rejects a million commands fast, by size and by count", () => {
    const source = `M0 0${"L1 1".repeat(1_000_000)}`;
    const started = performance.now();
    expect(failureOf(source)).toBe(PathFailure.SourceTooLong);
    const huge: PathLimits = { ...limits, maxSource: 10_000_000 };
    expect(failureOf(source, huge)).toBe(PathFailure.TooManyCommands);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("limits the command count after arcs are expanded", () => {
    const arcs = `M0 0${"a5 5 0 1 1 10 0".repeat(2000)}`;
    expect(failureOf(arcs)).toBe(PathFailure.TooManyCommands);
    expect(failureOf("M0 0 L1 1 L2 2", { ...limits, maxCommands: 2 })).toBe(
      PathFailure.TooManyCommands,
    );
  });

  it("survives long pathological runs in linear time", () => {
    const wide: PathLimits = { ...limits, maxSource: 1_000_000 };
    const started = performance.now();
    failureOf(`M0 0 L${"1".repeat(200_000)} 0`, wide);
    failureOf(`M0 0${" ,".repeat(100_000)}`, wide);
    failureOf(`M0 0 L${"-.".repeat(100_000)}`, wide);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("bounds", () => {
  it("uses curve extrema, not the control polygon", () => {
    const quad = boundsOf("M0 0 Q50 100 100 0");
    expect(quad).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 50 });
    const cubic = boundsOf("M0 0 C0 100 100 100 100 0");
    expect(cubic.maxY).toBeCloseTo(75, 9);
    expect(cubic.maxX).toBe(100);
    const sideways = boundsOf("M0 0 C100 0 100 100 0 100");
    expect(sideways.maxX).toBeCloseTo(75, 9);
  });

  it("finds interior extrema on both axes and negative ones", () => {
    const s = boundsOf("M0 0 C-60 20 60 80 0 100");
    expect(s.minX).toBeLessThan(-10);
    expect(s.maxX).toBeGreaterThan(10);
    expect(s.minY).toBe(0);
    expect(s.maxY).toBe(100);
  });

  it("handles degenerate curves", () => {
    expect(boundsOf("M0 0 C10 10 20 20 30 30")).toEqual({ minX: 0, minY: 0, maxX: 30, maxY: 30 });
    expect(boundsOf("M5 5 Q5 5 5 5 L5 5")).toEqual({ minX: 5, minY: 5, maxX: 5, maxY: 5 });
  });

  it("bounds lines and closed shapes", () => {
    expect(boundsOf("M-5 2 L10 -3 L4 9 Z")).toEqual({ minX: -5, minY: -3, maxX: 10, maxY: 9 });
  });

  it("matches a full circle drawn with arcs", () => {
    const circle = boundsOf("M0 10 A10 10 0 1 1 20 10 A10 10 0 1 1 0 10");
    expect(circle.minX).toBeCloseTo(0, 1);
    expect(circle.maxX).toBeCloseTo(20, 1);
    expect(circle.minY).toBeCloseTo(0, 1);
    expect(circle.maxY).toBeCloseTo(20, 1);
  });

  it("fails on an empty command list", () => {
    expect(pathBounds([]).ok).toBe(false);
  });
});

describe("round trip", () => {
  const samples = [
    "M10 10 h5 v5 h-5 z",
    "M0 0 C10 0 20 10 20 20 s10 10 20 0 t5 5",
    "M0 0 A10 10 30 1 0 17.3 4.2 a3 7 -20 0 1 4 4 Z",
    "m0.0004 0.00049 l1e-7 1e3 q1.23456 9.87654 100.5 -0.5",
    "M1 1 L2 2 Z M5 5 L7 7 L9 1 Z",
  ];

  it.each(samples)("normalize, serialize, normalize is idempotent for %s", (source) => {
    const first = normalize(source);
    const second = normalize(first);
    expect(second).toBe(first);
    const reread = readNormalizedPath(first, limits);
    expect(reread.ok).toBe(true);
    if (!reread.ok) return;
    const again = serializePath(reread.commands, limits);
    expect(again.ok && again.d).toBe(first);
  });
});

describe("validator and serializer", () => {
  it("accepts only the allowed alphabet", () => {
    expect(validatePathData("M0 0L1 1,2e3C1 2 3 4 5 6Q1 2 3 4Z", limits)).toEqual({
      ok: true,
      commands: 5,
    });
    for (const bad of ["M0 0l1 1", "M0 0H1", "M0 0\nL1 1", "M0 0\tL1 1", "M0 0 <script>"]) {
      const result = validatePathData(bad, limits);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe(PathFailure.BadCharacter);
    }
    expect(validatePathData("L0 0", limits).ok).toBe(false);
    expect(validatePathData("", limits).ok).toBe(false);
  });

  it("enforces the length and command limits", () => {
    const long = `M0 0${"L1 1".repeat(5000)}`;
    const tooLong = validatePathData(long, { maxData: 16384, maxCommands: 10_000 });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.message).toBe(PathFailure.DataTooLong);
    const many = validatePathData(long, { maxData: 100_000, maxCommands: 3000 });
    expect(many.ok).toBe(false);
    if (!many.ok) expect(many.message).toBe(PathFailure.TooManyCommands);
    expect(validatePathData(`M0 0${"L1 1".repeat(2999)}`, limits).ok).toBe(true);
  });

  it("serializes with fixed precision and only Path2D-safe characters", () => {
    const commands: PathCommand[] = [
      { type: "M", x: -0, y: 1 / 3 },
      { type: "C", x1: 1e-9, y1: 2.00049, x2: 3.0005, y2: -4.9996, x: 1234567.8, y: 0 },
      { type: "Z" },
    ];
    const result = serializePath(commands, limits);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.d).toBe("M0 0.333C0 2 3.001 -5 1234567.8 0Z");
    expect(/^[MLCQZ0-9.eE+\- ,]+$/.test(result.d)).toBe(true);
    expect(validatePathData(result.d, limits).ok).toBe(true);
  });

  it("refuses to serialize invalid command lists", () => {
    const failure = (commands: PathCommand[], use = limits): string => {
      const result = serializePath(commands, use);
      return result.ok ? "ok" : result.message;
    };
    const small: PathCommand[] = [
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 1, y: 1 },
    ];
    expect(failure([])).toBe(PathFailure.Empty);
    expect(failure([{ type: "L", x: 1, y: 1 }])).toBe(PathFailure.BadStart);
    expect(failure([{ type: "M", x: Number.NaN, y: 0 }])).toBe(PathFailure.OutOfRange);
    expect(failure([{ type: "M", x: Number.POSITIVE_INFINITY, y: 0 }])).toBe(
      PathFailure.OutOfRange,
    );
    expect(failure([{ type: "M", x: 1e308, y: 0 }])).toBe(PathFailure.OutOfRange);
    expect(failure(small, { maxData: 5, maxCommands: 10 })).toBe(PathFailure.DataTooLong);
  });

  it("never copies the source text", () => {
    const result = normalizePathData("M 0.50000 0 L 10.0 10.000   Z", limits);
    expect(result.ok && result.d).toBe("M0.5 0L10 10Z");
  });
});

describe("merge, transform and box fitting", () => {
  it("merges subpaths and checks the combined limits", () => {
    const a = parsePathData("M0 0 L1 1", limits);
    const b = parsePathData("M5 5 L6 6 Z", limits);
    if (!a.ok || !b.ok) throw new Error("fixture");
    const merged = mergePaths([a.commands, b.commands], limits);
    if (!merged.ok) throw new Error("fixture");
    expect(serializePath(merged.commands, limits)).toEqual({ ok: true, d: "M0 0L1 1M5 5L6 6Z" });
    expect(mergePaths([a.commands, b.commands], { ...limits, maxCommands: 4 }).ok).toBe(false);
  });

  it("transforms curves with an affine matrix", () => {
    const parsed = parsePathData("M0 0 C0 10 10 10 10 0", limits);
    if (!parsed.ok) throw new Error("fixture");
    const moved = transformPath(parsed.commands, translate(5, 5), limits);
    if (!moved.ok) throw new Error("fixture");
    const movedBounds = pathBounds(moved.commands);
    expect(movedBounds.ok && movedBounds.bounds.minX).toBe(5);
    const turned = transformPath(parsed.commands, rotate(90), limits);
    if (!turned.ok) throw new Error("fixture");
    const bounds = pathBounds(turned.commands);
    expect(bounds.ok && bounds.bounds.minX).toBeCloseTo(-7.5, 9);
    expect(transformPath(parsed.commands, scale(1e308), limits).ok).toBe(false);
  });

  it("moves the shape to 0,0 and scales it into box units", () => {
    const parsed = parsePathData("M100 200 C100 300 200 300 200 200 Z", limits);
    if (!parsed.ok) throw new Error("fixture");
    const box = toBoxLocal(parsed.commands, { scale: 0.5, maxSize: 20000 }, limits);
    expect(box.ok).toBe(true);
    if (!box.ok) return;
    expect(box.width).toBe(50);
    expect(box.height).toBeCloseTo(37.5, 3);
    const bounds = pathBounds(box.commands);
    expect(bounds.ok && bounds.bounds.minX).toBe(0);
    expect(bounds.ok && bounds.bounds.minY).toBe(0);
  });

  it("refuses boxes above the size limit and invalid scales", () => {
    const parsed = parsePathData("M0 0 L30000 10", limits);
    if (!parsed.ok) throw new Error("fixture");
    const big = toBoxLocal(parsed.commands, { scale: 1, maxSize: 20000 }, limits);
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.message).toBe(PathFailure.TooLarge);
    expect(toBoxLocal(parsed.commands, { scale: 0, maxSize: 20000 }, limits).ok).toBe(false);
    expect(toBoxLocal(parsed.commands, { scale: Number.NaN, maxSize: 20000 }, limits).ok).toBe(
      false,
    );
  });
});
