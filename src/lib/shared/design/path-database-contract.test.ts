import { describe, expect, it } from "vitest";
import { databaseDocumentBytes } from "@/lib/shared/design/document-size";
import { createPath } from "@/lib/shared/design/path";
import { designDocumentSchema, pathElementSchema } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import { normalizePathData } from "@/lib/shared/design/vector/path-data";

const PAGE = { width: 1080, height: 1080 };
const SQL_ALPHABET = /^[MLCQZ0-9.eE+ ,-]+$/;
const LIMITS = { maxData: DESIGN_LIMITS.maxPathData, maxCommands: DESIGN_LIMITS.maxPathCommands };

const valid = (d: string) =>
  pathElementSchema.safeParse({
    ...createPath({ id: "p1", d: "M0 0L10 0L10 10Z", width: 10, height: 10 }, PAGE),
    d,
  }).success;

describe("path data against the database contract", () => {
  it("refuses tabs, newlines, non-breaking spaces and whitespace-only data", () => {
    expect(valid("M0 0\tL1 1")).toBe(false);
    expect(valid("M0 0\nL1 1")).toBe(false);
    expect(valid("M0 0 L1 1")).toBe(false);
    expect(valid("   ")).toBe(false);
    expect(valid("1 2 3")).toBe(false);
    expect(valid("M0 0 L1 1")).toBe(true);
  });

  it("writes only characters the database alphabet accepts", () => {
    const sources = [
      "M0 0 H10 V10 Z",
      "m1e-7 2.5E+3 l-4,-5 c1 2 3 4 5 6 z",
      "M0 0 A5 5 0 0 1 10 10 S1 1 2 2 T3 3",
      "M10 10 Q20 20 30 10\n\tL5 5",
    ];
    for (const source of sources) {
      const result = normalizePathData(source, LIMITS);
      expect(result.ok).toBe(true);
      if (result.ok) expect(SQL_ALPHABET.test(result.d)).toBe(true);
    }
  });
});

describe("document size estimate", () => {
  const documentWith = (id: string) =>
    designDocumentSchema.parse({
      version: 4,
      pages: [{ id, background: null, elements: [] }],
    });

  it("adds the space jsonb prints after each colon and comma", () => {
    const document = documentWith("p");
    const json = JSON.stringify(document);
    const separators = (json.match(/[,:]/g) ?? []).length;
    expect(databaseDocumentBytes(document)).toBe(json.length + separators);
  });

  it("does not count separators or escaped quotes inside strings", () => {
    const plain = databaseDocumentBytes(documentWith("p"));
    const quoted = databaseDocumentBytes(documentWith(String.raw`a,b:\"c`));
    expect(quoted - plain).toBe(8);
  });

  it("counts numbers that JavaScript prints with an exponent as jsonb prints them", () => {
    const documentOf = (opacity: number) =>
      designDocumentSchema.parse({
        version: 4,
        pages: [
          {
            id: "p",
            background: null,
            elements: [
              {
                ...createPath({ id: "e", d: "M0 0L1 1Z", width: 10, height: 10 }, PAGE),
                opacity,
              },
            ],
          },
        ],
      });
    const base = databaseDocumentBytes(documentOf(1));
    expect(databaseDocumentBytes(documentOf(1e-300))).toBeGreaterThanOrEqual(base + 300);
    expect(databaseDocumentBytes(documentOf(0.1 + 0.2 - 0.3 + 1e-17))).toBeGreaterThanOrEqual(
      base + 30,
    );
  });
});
