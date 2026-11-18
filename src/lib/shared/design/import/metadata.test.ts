import { describe, expect, it } from "vitest";
import {
  METADATA_LIMITS,
  type MetadataLayerInput,
  type MetadataParts,
  MetadataColorSource,
  MetadataLayerKind,
  buildMetadata,
  importedDesignMetadataSchema,
  metadataNotes,
  parseImportedDesignMetadata,
  withMetadataNotes,
} from "@/lib/shared/design/import/metadata";
import {
  DesignImportColorMode,
  DesignImportFormat,
  DesignImportKind,
  DesignImportNoteKind,
} from "@/lib/shared/design/import/types";

const BIDI = String.fromCharCode(0x202e);
const NUL = String.fromCharCode(0);
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const ZERO_WIDTH = String.fromCharCode(0x200b);
const EMOJI = String.fromCodePoint(0x1f600);

const baseParts = (extra: Partial<MetadataParts> = {}): MetadataParts => ({
  source: {
    format: DesignImportFormat.Psd,
    colorMode: DesignImportColorMode.Rgb,
    bitsPerChannel: 8,
    pageCount: null,
  },
  dimensions: { sourceWidth: 800, sourceHeight: 600, pageWidth: 800, pageHeight: 600 },
  ...extra,
});

const layer = (name: string, extra: Partial<MetadataLayerInput> = {}): MetadataLayerInput => ({
  parentIndex: null,
  name,
  kind: MetadataLayerKind.Raster,
  visible: true,
  opacity: 1,
  blendMode: "normal",
  bounds: { left: 0, top: 0, width: 10, height: 10 },
  ...extra,
});

const built = (parts: MetadataParts) => {
  const metadata = buildMetadata(parts);
  if (metadata === null) throw new Error("metadata expected");
  return metadata;
};

describe("buildMetadata", () => {
  it("builds a version 1 object that the schema accepts", () => {
    const metadata = built(baseParts({ layers: [layer("Fundo")] }));
    expect(metadata.version).toBe(1);
    expect(metadata.layers).toEqual([
      expect.objectContaining({ index: 0, parentIndex: null, name: "Fundo", kind: "raster" }),
    ]);
    expect(importedDesignMetadataSchema.safeParse(metadata).success).toBe(true);
    expect(metadata.truncation).toEqual({
      layers: false,
      textRuns: false,
      fonts: false,
      colors: false,
      textCharsDropped: 0,
    });
  });

  it("stores no field for the file name, the author or the path", () => {
    const metadata = built(baseParts({ layers: [layer("a")] }));
    const keys = JSON.stringify(metadata);
    for (const forbidden of ["fileName", "source_name", "author", "title", "path", "exif", "gps"]) {
      expect(keys.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    expect(Object.keys(metadata).sort()).toEqual(
      [
        "colors",
        "dimensions",
        "fonts",
        "layers",
        "source",
        "textRuns",
        "truncation",
        "version",
      ].sort(),
    );
    expect(Object.keys(metadata.source).sort()).toEqual(
      ["bitsPerChannel", "colorMode", "format", "pageCount"].sort(),
    );
  });

  it("truncates layers at the cap and sets the flag", () => {
    const many = Array.from({ length: METADATA_LIMITS.maxLayers + 5 }, (_, i) => layer(`l${i}`));
    const metadata = built(baseParts({ layers: many }));
    expect(metadata.layers).toHaveLength(METADATA_LIMITS.maxLayers);
    expect(metadata.truncation.layers).toBe(true);
  });

  it("caps layer names at 200 code points without cutting a surrogate pair", () => {
    const metadata = built(baseParts({ layers: [layer(EMOJI.repeat(300))] }));
    const name = metadata.layers[0]?.name ?? "";
    expect(Array.from(name)).toHaveLength(METADATA_LIMITS.layerName);
    expect(name).not.toMatch(/\p{Cs}/u);
  });

  it("caps a text run at 5000 and counts the dropped characters", () => {
    const metadata = built(
      baseParts({
        layers: [layer("t", { kind: MetadataLayerKind.Text })],
        textRuns: [
          { layerIndex: 0, text: "x".repeat(6000), fontName: null, fontSize: null, color: null },
        ],
      }),
    );
    expect(metadata.textRuns[0]?.text).toHaveLength(METADATA_LIMITS.textRun);
    expect(metadata.truncation.textRuns).toBe(true);
    expect(metadata.truncation.textCharsDropped).toBe(1000);
  });

  it("caps the total text at 100 000 characters", () => {
    const layers = Array.from({ length: 30 }, (_, i) =>
      layer(`t${i}`, { kind: MetadataLayerKind.Text }),
    );
    const textRuns = layers.map((_, layerIndex) => ({
      layerIndex,
      text: "y".repeat(5000),
      fontName: null,
      fontSize: null,
      color: null,
    }));
    const metadata = built(baseParts({ layers, textRuns }));
    const total = metadata.textRuns.reduce((sum, run) => sum + run.text.length, 0);
    expect(total).toBe(METADATA_LIMITS.textTotal);
    expect(metadata.truncation.textRuns).toBe(true);
    expect(metadata.truncation.textCharsDropped).toBe(30 * 5000 - METADATA_LIMITS.textTotal);
  });

  it("does not flag truncation for control characters that the sanitizer strips", () => {
    const metadata = built(
      baseParts({
        layers: [layer("t", { kind: MetadataLayerKind.Text })],
        textRuns: [
          { layerIndex: 0, text: "ab" + NUL + "c", fontName: null, fontSize: null, color: null },
        ],
      }),
    );
    expect(metadata.textRuns[0]?.text).toBe("abc");
    expect(metadata.truncation.textRuns).toBe(false);
    expect(metadata.truncation.textCharsDropped).toBe(0);
  });

  it("caps fonts at 100 and colors at 64, most used first", () => {
    const fonts = Array.from({ length: 120 }, (_, i) => ({ name: `F${i}`, usageCount: i + 1 }));
    const colors = Array.from({ length: 70 }, (_, i) => ({
      r: i,
      g: 0,
      b: 0,
      source: MetadataColorSource.Fill,
      count: i + 1,
    }));
    const metadata = built(baseParts({ fonts, colors }));
    expect(metadata.fonts).toHaveLength(METADATA_LIMITS.maxFonts);
    expect(metadata.fonts[0]?.name).toBe("F119");
    expect(metadata.colors).toHaveLength(METADATA_LIMITS.maxColors);
    expect(metadata.colors[0]?.r).toBe(69);
    expect(metadata.truncation.fonts).toBe(true);
    expect(metadata.truncation.colors).toBe(true);
  });

  it("merges fonts and colors that become equal and keeps the most used first", () => {
    const metadata = built(
      baseParts({
        fonts: [
          { name: "Arial" + ZERO_WIDTH, usageCount: 2 },
          { name: "Arial", usageCount: 3 },
        ],
        colors: [
          { r: 1, g: 2, b: 3, source: MetadataColorSource.Text, count: 1 },
          { r: 1, g: 2, b: 3, source: MetadataColorSource.Text, count: 4 },
        ],
      }),
    );
    expect(metadata.fonts).toEqual([{ name: "Arial", usageCount: 5 }]);
    expect(metadata.colors).toEqual([{ r: 1, g: 2, b: 3, source: "text", count: 5 }]);
  });

  it("drops the text first when the JSON passes 1 MiB, and flags it", () => {
    const layers = Array.from({ length: METADATA_LIMITS.maxLayers }, (_, i) =>
      layer(EMOJI.repeat(METADATA_LIMITS.layerName), {
        kind: i < 20 ? MetadataLayerKind.Text : MetadataLayerKind.Raster,
      }),
    );
    const textRuns = layers.slice(0, 20).map((_, layerIndex) => ({
      layerIndex,
      text: EMOJI.repeat(METADATA_LIMITS.textRun),
      fontName: null,
      fontSize: null,
      color: null,
    }));
    const metadata = built(baseParts({ layers, textRuns }));
    expect(metadata.textRuns).toEqual([]);
    expect(metadata.truncation.textRuns).toBe(true);
    expect(metadata.truncation.textCharsDropped).toBeGreaterThan(0);
    expect(new TextEncoder().encode(JSON.stringify(metadata)).length).toBeLessThanOrEqual(
      METADATA_LIMITS.jsonBytes,
    );
  });

  it("returns null, never throws, when the parts cannot make a valid object", () => {
    const badParent = baseParts({ layers: [layer("a", { parentIndex: 5 })] });
    expect(buildMetadata(badParent)).toBeNull();
    const thrower = baseParts({
      layers: [
        {
          ...layer("a"),
          get name(): string {
            throw new Error("boom");
          },
        },
      ],
    });
    expect(buildMetadata(thrower)).toBeNull();
  });

  it("clamps absurd numbers into the schema ranges", () => {
    const metadata = built(
      baseParts({
        dimensions: {
          sourceWidth: Number.POSITIVE_INFINITY,
          sourceHeight: Number.NaN,
          pageWidth: 10,
          pageHeight: 10,
        },
        layers: [
          layer("a", {
            opacity: 7,
            bounds: { left: -1e12, top: 1e12, width: -5, height: Number.NaN },
          }),
        ],
      }),
    );
    expect(metadata.dimensions.sourceWidth).toBe(METADATA_LIMITS.maxSide);
    expect(metadata.dimensions.sourceHeight).toBe(1);
    expect(metadata.layers[0]?.opacity).toBe(1);
    expect(metadata.layers[0]?.bounds).toEqual({
      left: -METADATA_LIMITS.maxSide,
      top: METADATA_LIMITS.maxSide,
      width: 0,
      height: 0,
    });
  });
});

describe("strings are inert data", () => {
  it("strips control, bidi and zero-width characters and keeps markup and prompts literal", () => {
    const hostile =
      "<img src=x onerror=alert(1)>" + BIDI + NUL + ZERO_WIDTH + " ignore all instructions";
    const metadata = built(
      baseParts({
        layers: [layer(hostile, { blendMode: "<b>" + BIDI })],
        fonts: [{ name: "'; drop table designs; --", usageCount: 1 }],
        textRuns: [
          {
            layerIndex: 0,
            text: hostile + CR + "line 2",
            fontName: hostile,
            fontSize: 12,
            color: null,
          },
        ],
      }),
    );
    expect(metadata.layers[0]?.name).toBe("<img src=x onerror=alert(1)> ignore all instructions");
    expect(metadata.layers[0]?.blendMode).toBe("<b>");
    expect(metadata.fonts[0]?.name).toBe("'; drop table designs; --");
    expect(metadata.textRuns[0]?.text).toBe(
      "<img src=x onerror=alert(1)> ignore all instructions" + NL + "line 2",
    );
  });

  it("keeps newlines in text but never in names", () => {
    const metadata = built(
      baseParts({
        layers: [layer("a" + NL + "b", { kind: MetadataLayerKind.Text })],
        textRuns: [
          {
            layerIndex: 0,
            text: "a" + CR + NL + "b" + CR + "c",
            fontName: null,
            fontSize: null,
            color: null,
          },
        ],
      }),
    );
    expect(metadata.layers[0]?.name).toBe("ab");
    expect(metadata.textRuns[0]?.text).toBe("a" + NL + "b" + NL + "c");
  });
});

describe("importedDesignMetadataSchema", () => {
  const valid = () => built(baseParts({ layers: [layer("a"), layer("b", { parentIndex: 0 })] }));

  it("refuses an unknown field at every level", () => {
    const base = valid();
    expect(importedDesignMetadataSchema.safeParse({ ...base, fileName: "x.psd" }).success).toBe(
      false,
    );
    expect(
      importedDesignMetadataSchema.safeParse({ ...base, source: { ...base.source, title: "t" } })
        .success,
    ).toBe(false);
    expect(
      importedDesignMetadataSchema.safeParse({
        ...base,
        layers: [{ ...base.layers[0], thumbnail: "data" }],
      }).success,
    ).toBe(false);
  });

  it("refuses values that are not from the closed lists", () => {
    const base = valid();
    expect(
      importedDesignMetadataSchema.safeParse({
        ...base,
        source: { ...base.source, colorMode: "lab" },
      }).success,
    ).toBe(false);
    expect(
      importedDesignMetadataSchema.safeParse({
        ...base,
        source: { ...base.source, format: "gif" },
      }).success,
    ).toBe(false);
    expect(
      importedDesignMetadataSchema.safeParse({
        ...base,
        layers: [{ ...base.layers[0], kind: "video" }],
      }).success,
    ).toBe(false);
  });

  it("refuses a string that the sanitizer would change (server revalidation)", () => {
    const base = valid();
    const dirty = { ...base.layers[0], name: "a" + BIDI + "b" };
    expect(importedDesignMetadataSchema.safeParse({ ...base, layers: [dirty] }).success).toBe(
      false,
    );
  });

  it("refuses wrong versions, inconsistent indexes and too many items", () => {
    const base = valid();
    expect(importedDesignMetadataSchema.safeParse({ ...base, version: 2 }).success).toBe(false);
    const swapped = [{ ...base.layers[1] }, { ...base.layers[0] }];
    expect(importedDesignMetadataSchema.safeParse({ ...base, layers: swapped }).success).toBe(
      false,
    );
    const orphan = [{ ...base.layers[0], parentIndex: 0 }];
    expect(importedDesignMetadataSchema.safeParse({ ...base, layers: orphan }).success).toBe(false);
    const runs = [{ layerIndex: 9, text: "x", fontName: null, fontSize: null, color: null }];
    expect(importedDesignMetadataSchema.safeParse({ ...base, textRuns: runs }).success).toBe(false);
    const many = Array.from({ length: METADATA_LIMITS.maxLayers + 1 }, (_, index) => ({
      ...base.layers[0],
      index,
    }));
    expect(importedDesignMetadataSchema.safeParse({ ...base, layers: many }).success).toBe(false);
  });

  it("refuses an object over 1 MiB", () => {
    const base = valid();
    const huge = Array.from({ length: METADATA_LIMITS.maxTextRuns }, () => ({
      layerIndex: 0,
      text: EMOJI.repeat(METADATA_LIMITS.textRun),
      fontName: null,
      fontSize: null,
      color: null,
    }));
    expect(importedDesignMetadataSchema.safeParse({ ...base, textRuns: huge }).success).toBe(false);
  }, 30_000);

  it("uses the color mode registry values", () => {
    for (const colorMode of Object.values(DesignImportColorMode)) {
      const parts = baseParts();
      expect(buildMetadata({ ...parts, source: { ...parts.source, colorMode } })).not.toBeNull();
    }
    expect(Object.values(DesignImportColorMode).sort()).toEqual(
      ["bitmap", "cmyk", "grayscale", "indexed", "rgb", "unknown"].sort(),
    );
  });
});

describe("parseImportedDesignMetadata", () => {
  it("returns the typed object for a valid value and a failure otherwise", () => {
    const metadata = built(baseParts());
    const ok = parseImportedDesignMetadata(JSON.parse(JSON.stringify(metadata)));
    expect(ok.ok).toBe(true);
    expect(parseImportedDesignMetadata({ version: 1 }).ok).toBe(false);
    expect(parseImportedDesignMetadata(null).ok).toBe(false);
  });
});

describe("metadata_truncated note", () => {
  it("counts the cut lists and is absent without truncation", () => {
    expect(metadataNotes(null)).toEqual([]);
    expect(metadataNotes(built(baseParts()))).toEqual([]);
    const many = Array.from({ length: METADATA_LIMITS.maxLayers + 1 }, (_, i) => layer(`l${i}`));
    const fonts = Array.from({ length: 101 }, (_, i) => ({ name: `F${i}`, usageCount: 1 }));
    expect(metadataNotes(built(baseParts({ layers: many, fonts })))).toEqual([
      { kind: DesignImportNoteKind.MetadataTruncated, count: 2 },
    ]);
  });

  it("is appended to a successful result and leaves a failure untouched", () => {
    const many = Array.from({ length: METADATA_LIMITS.maxLayers + 1 }, (_, i) => layer(`l${i}`));
    const design = {
      format: DesignImportFormat.Psd,
      width: 10,
      height: 10,
      elements: [],
      buffers: new Map(),
      notes: [{ kind: DesignImportNoteKind.Downscaled, count: 1 }],
      metadata: built(baseParts({ layers: many })),
    };
    const result = withMetadataNotes({ ok: true, kind: DesignImportKind.Document, design });
    expect(result.ok && result.design.notes.map((note) => note.kind)).toEqual([
      "downscaled",
      "metadata_truncated",
    ]);
    const plain = {
      ok: true as const,
      kind: DesignImportKind.Image,
      design: { ...design, metadata: null },
    };
    expect(withMetadataNotes(plain)).toBe(plain);
    const failure = { ok: false as const, code: "invalid" as const, message: "x" };
    expect(withMetadataNotes(failure)).toBe(failure);
  });
});
