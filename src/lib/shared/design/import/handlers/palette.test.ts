import { describe, expect, it } from "vitest";
import { acoHandler, parseAco } from "@/lib/shared/design/import/handlers/palette-aco";
import { aseHandler, parseAse } from "@/lib/shared/design/import/handlers/palette-ase";
import { gplHandler, parseGpl } from "@/lib/shared/design/import/handlers/palette-gpl";
import {
  cmykToRgb,
  grayToRgb,
  hsbToRgb,
  labToRgb,
  toHex,
} from "@/lib/shared/design/import/handlers/palette-model";
import { acoBytes, aseBytes, gplBytes } from "@/lib/shared/design/import/handlers/palette-fixtures";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import {
  DesignImportKind,
  DesignImportNoteKind,
  type ImportPalette,
} from "@/lib/shared/design/import/types";
import type { Result } from "@/lib/shared/server-utils";
import type { ImportOutcome } from "@/lib/shared/design/import/types";

const paletteOf = (result: Result<ImportOutcome>): ImportPalette => {
  if (!result.ok || result.kind !== DesignImportKind.Palette) throw new Error("palette expected");
  return result.palette;
};

const messageOf = (result: Result<ImportOutcome>): string | null =>
  result.ok ? null : result.message;

const channelsOf = (hex: string): number[] =>
  [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));

const within = (actual: number[], expected: number[], tolerance: number): void => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) =>
    expect(Math.abs(value - (expected[index] ?? 0))).toBeLessThanOrEqual(tolerance),
  );
};

describe("color math (pure, known vectors)", () => {
  it("formats and clamps channels and never emits NaN", () => {
    expect(toHex(255, 0, 16)).toBe(`#${"ff0010"}`);
    expect(toHex(300, -5, Number.NaN)).toBe(`#${"ff0000"}`);
  });

  it("converts the naive CMYK, gray and HSB vectors", () => {
    expect(cmykToRgb(0, 0, 0, 0)).toEqual([255, 255, 255]);
    expect(cmykToRgb(0, 0, 0, 1)).toEqual([0, 0, 0]);
    expect(cmykToRgb(1, 0, 0, 0)).toEqual([0, 255, 255]);
    expect(grayToRgb(0.5)).toEqual([127.5, 127.5, 127.5]);
    within(hsbToRgb(0, 1, 1), [255, 0, 0], 0);
    within(hsbToRgb(120, 1, 1), [0, 255, 0], 0);
  });

  it("converts Lab D50 white, black and mid gray to sRGB", () => {
    within(labToRgb(100, 0, 0), [255, 255, 255], 2);
    within(labToRgb(0, 0, 0), [0, 0, 0], 1);
    within(labToRgb(53.585, 0, 0), [128, 128, 128], 3);
  });
});

describe("ASE", () => {
  it("reads RGB, CMYK, Lab, gray and a group, flagging converted swatches", () => {
    const result = parseAse(
      aseBytes([
        { kind: "group", name: "Brand" },
        { kind: "color", name: "Red", model: "RGB ", values: [1, 0, 0] },
        { kind: "color", name: "Cyan", model: "CMYK", values: [1, 0, 0, 0] },
        { kind: "end" },
        { kind: "color", name: "White", model: "LAB ", values: [1, 0, 0] },
        { kind: "color", name: "Mid", model: "Gray", values: [0.5] },
      ]),
    );
    const palette = paletteOf(result);
    expect(palette.swatches.map((swatch) => swatch.name)).toEqual([
      "Brand / Red",
      "Brand / Cyan",
      "White",
      "Mid",
    ]);
    within(channelsOf(palette.swatches[0]?.hex ?? ""), [255, 0, 0], 1);
    within(channelsOf(palette.swatches[1]?.hex ?? ""), [0, 255, 255], 1);
    expect(palette.swatches.map((swatch) => swatch.converted)).toEqual([false, true, true, true]);
    expect(palette.notes).toEqual([{ kind: DesignImportNoteKind.SwatchConverted, count: 3 }]);
  });

  it("fails fast on a block count of 4e9 with a few bytes", () => {
    const started = Date.now();
    const result = parseAse(aseBytes([], { declaredBlocks: 4_000_000_000 }));
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.paletteCorrupt);
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("refuses a name longer than its block and a block longer than the file", () => {
    const good = aseBytes([{ kind: "color", name: "Ab", model: "RGB ", values: [1, 0, 0] }]);
    const longName = good.slice();
    longName[13 + 5] = 0xff;
    expect(messageOf(parseAse(longName))).toBe(DESIGN_IMPORT_MESSAGE.paletteCorrupt);
    expect(messageOf(parseAse(good.slice(0, good.length - 3)))).toBe(
      DESIGN_IMPORT_MESSAGE.paletteCorrupt,
    );
  });

  it("strips control and bidi characters and truncates a 10 KB name to 40", () => {
    const name = `${String.fromCharCode(0x202e)}a${String.fromCharCode(7)}${"b".repeat(200)}`;
    const palette = paletteOf(
      parseAse(aseBytes([{ kind: "color", name, model: "RGB ", values: [1, 0, 0] }])),
    );
    const stored = palette.swatches[0]?.name ?? "";
    expect(stored.length).toBeLessThanOrEqual(40);
    expect(stored.startsWith("ab")).toBe(true);
  });

  it("refuses more than 1000 swatches and an empty palette", () => {
    const many = Array.from({ length: 1001 }, (_, index) => ({
      kind: "color" as const,
      name: `c${index}`,
      model: "RGB " as const,
      values: [index / 1001, 0, 0],
    }));
    expect(messageOf(parseAse(aseBytes(many)))).toBe(DESIGN_IMPORT_MESSAGE.paletteTooManySwatches);
    expect(messageOf(parseAse(aseBytes([])))).toBe(DESIGN_IMPORT_MESSAGE.paletteEmpty);
  });

  it("dedupes equal colors and registers through the handler", async () => {
    const bytes = aseBytes([
      { kind: "color", name: "A", model: "RGB ", values: [1, 0, 0] },
      { kind: "color", name: "B", model: "RGB ", values: [1, 0, 0] },
    ]);
    expect(aseHandler.sniff(bytes)).toBe(true);
    expect(paletteOf(parseAse(bytes)).swatches).toHaveLength(1);
  });
});

describe("ACO", () => {
  it("reads v1-only, v2-only and v1 plus v2 (names from v2)", () => {
    const entries = [
      { space: 0, values: [65535, 0, 0, 0] as [number, number, number, number], name: "Red" },
    ];
    const v1 = paletteOf(parseAco(acoBytes(entries, { version: 1 })));
    const v2 = paletteOf(parseAco(acoBytes(entries, { version: 2 })));
    const both = paletteOf(parseAco(acoBytes(entries)));
    for (const palette of [v1, v2, both]) {
      expect(palette.swatches).toHaveLength(1);
      within(channelsOf(palette.swatches[0]?.hex ?? ""), [255, 0, 0], 1);
    }
    expect(both.swatches[0]?.name).toBe("Red");
    expect(acoHandler.sniff(acoBytes(entries))).toBe(true);
  });

  it("converts CMYK (stored inverted), Lab and gray with a note", () => {
    const palette = paletteOf(
      parseAco(
        acoBytes([
          { space: 2, values: [0, 65535, 65535, 65535], name: "Cyan" },
          { space: 7, values: [10000, 0, 0, 0], name: "White" },
          { space: 8, values: [5000, 0, 0, 0], name: "Gray" },
        ]),
      ),
    );
    within(channelsOf(palette.swatches[0]?.hex ?? ""), [0, 255, 255], 1);
    expect(palette.notes[0]?.count).toBe(3);
  });

  it("skips an unknown color space and refuses a file where all are unknown", () => {
    const mixed = acoBytes([
      { space: 99, values: [1, 2, 3, 4], name: "x" },
      { space: 0, values: [0, 0, 65535, 0], name: "Blue" },
    ]);
    expect(paletteOf(parseAco(mixed)).swatches).toHaveLength(1);
    const unknown = acoBytes([{ space: 99, values: [1, 2, 3, 4], name: "x" }]);
    expect(messageOf(parseAco(unknown))).toBe(DESIGN_IMPORT_MESSAGE.paletteEmpty);
  });

  it("refuses a v1 count of 65535 with a few bytes and a v2 name beyond the file", () => {
    const entries = [{ space: 0, values: [1, 2, 3, 4] as [number, number, number, number] }];
    expect(messageOf(parseAco(acoBytes(entries, { version: 1, declaredCount: 65535 })))).toBe(
      DESIGN_IMPORT_MESSAGE.paletteCorrupt,
    );
    expect(messageOf(parseAco(acoBytes(entries, { version: 2, nameChars: 255 })))).toBe(
      DESIGN_IMPORT_MESSAGE.paletteCorrupt,
    );
  });
});

describe("GPL", () => {
  it("reads colors with names, comments and headers, clamping values", () => {
    const palette = paletteOf(
      parseGpl(
        gplBytes([
          "GIMP Palette",
          "Name: Test",
          "Columns: 4",
          "# comment",
          "255   0   0  Red",
          "300 -5 0 Odd",
          "abc 1 2 Bad",
          "0 0 255",
        ]),
      ),
    );
    expect(palette.swatches.map((swatch) => swatch.name)).toEqual(["Red", "Cor"]);
    within(channelsOf(palette.swatches[0]?.hex ?? ""), [255, 0, 0], 0);
    expect(palette.notes).toEqual([]);
  });

  it("refuses a missing header, 100000 lines and a very long line", () => {
    expect(messageOf(parseGpl(gplBytes(["nope"])))).toBe(DESIGN_IMPORT_MESSAGE.paletteCorrupt);
    const many = ["GIMP Palette", ...Array.from({ length: 100000 }, () => "1 2 3 a")];
    expect(messageOf(parseGpl(gplBytes(many)))).toBe(DESIGN_IMPORT_MESSAGE.paletteCorrupt);
    expect(messageOf(parseGpl(gplBytes(["GIMP Palette", `1 2 3 ${"x".repeat(5000)}`])))).toBe(
      DESIGN_IMPORT_MESSAGE.paletteCorrupt,
    );
    expect(gplHandler.sniff(gplBytes(["GIMP Palette"]))).toBe(true);
  });
});
