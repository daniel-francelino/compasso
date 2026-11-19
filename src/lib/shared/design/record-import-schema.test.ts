import { describe, expect, it } from "vitest";
import { METADATA_LIMITS, buildMetadata, withoutText } from "@/lib/shared/design/import/metadata";
import { DesignImportColorMode, DesignImportFormat } from "@/lib/shared/design/import/types";
import { recordDesignImportSchema } from "@/lib/shared/design/schemas";

const DESIGN_ID = "00000000-0000-4000-8000-000000000001";

const metadata = () => {
  const built = buildMetadata({
    source: {
      format: DesignImportFormat.Psd,
      colorMode: DesignImportColorMode.Rgb,
      bitsPerChannel: 8,
      pageCount: null,
    },
    dimensions: { sourceWidth: 800, sourceHeight: 600, pageWidth: 800, pageHeight: 600 },
  });
  if (built === null) throw new Error("metadata expected");
  return built;
};

describe("recordDesignImportSchema", () => {
  it("refuses an unknown top-level key", () => {
    expect(
      recordDesignImportSchema.safeParse({ id: DESIGN_ID, metadata: metadata(), extra: 1 }).success,
    ).toBe(false);
  });

  it("accepts a design id and metadata built by the client", () => {
    expect(
      recordDesignImportSchema.safeParse({ id: DESIGN_ID, metadata: metadata() }).success,
    ).toBe(true);
  });

  it("refuses non-empty text runs instead of overwriting them", () => {
    const withText = {
      ...metadata(),
      layers: [
        {
          index: 0,
          parentIndex: null,
          name: "a",
          kind: "text",
          visible: true,
          opacity: 1,
          blendMode: "normal",
          bounds: null,
        },
      ],
      textRuns: [{ layerIndex: 0, text: "hello", fontName: null, fontSize: null, color: null }],
    };
    expect(recordDesignImportSchema.safeParse({ id: DESIGN_ID, metadata: withText }).success).toBe(
      false,
    );
  });

  it("keeps the truncation fields consistent when the text runs are emptied", () => {
    const stripped = withoutText({
      ...metadata(),
      truncation: {
        layers: false,
        textRuns: false,
        fonts: false,
        colors: false,
        textCharsDropped: 3,
      },
    });
    expect(stripped.textRuns).toEqual([]);
    expect(stripped.truncation.textRuns).toBe(true);
    expect(recordDesignImportSchema.safeParse({ id: DESIGN_ID, metadata: stripped }).success).toBe(
      true,
    );
  });

  it("keeps a margin below the stored size cap for the jsonb text spacing", () => {
    expect(METADATA_LIMITS.jsonBytes + METADATA_LIMITS.jsonTextMargin).toBe(
      METADATA_LIMITS.storedJsonBytes,
    );
  });

  it("accepts metadata at the byte cap and refuses one byte above it", () => {
    const base = metadata();
    const emoji = String.fromCodePoint(0x1f600);
    const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
    const layers = Array.from({ length: METADATA_LIMITS.maxLayers }, (_, index) => ({
      index,
      parentIndex: null,
      name: emoji.repeat(METADATA_LIMITS.layerName),
      kind: "raster" as const,
      visible: true,
      opacity: 1,
      blendMode: "normal",
      bounds: null,
    }));
    const withFonts = (names: string[]) => ({
      ...base,
      layers,
      fonts: names.map((name) => ({ name, usageCount: 1 })),
    });
    const empty = Array.from({ length: METADATA_LIMITS.maxFonts }, () => "");
    let remaining = METADATA_LIMITS.jsonBytes - bytes(withFonts(empty));
    const perFont = 700;
    const quarter = 4;
    const names = empty.map(() => {
      const take = Math.min(remaining, perFont);
      remaining -= take;
      return emoji.repeat(Math.floor(take / quarter)) + "a".repeat(take % quarter);
    });
    expect(remaining).toBe(0);
    expect(bytes(withFonts(names))).toBe(METADATA_LIMITS.jsonBytes);
    expect(
      recordDesignImportSchema.safeParse({ id: DESIGN_ID, metadata: withFonts(names) }).success,
    ).toBe(true);
    const over = [...names.slice(0, -1), (names.at(-1) ?? "") + "a"];
    expect(bytes(withFonts(over))).toBe(METADATA_LIMITS.jsonBytes + 1);
    expect(
      recordDesignImportSchema.safeParse({ id: DESIGN_ID, metadata: withFonts(over) }).success,
    ).toBe(false);
  }, 30000);

  it("refuses a design id that is not a uuid", () => {
    expect(recordDesignImportSchema.safeParse({ id: "x", metadata: metadata() }).success).toBe(
      false,
    );
  });

  it("refuses a key outside the metadata schema (strict, SEC-6)", () => {
    const tampered = { ...metadata(), fileName: "secret.psd" };
    expect(recordDesignImportSchema.safeParse({ id: DESIGN_ID, metadata: tampered }).success).toBe(
      false,
    );
  });

  it("refuses metadata that is missing", () => {
    expect(recordDesignImportSchema.safeParse({ id: DESIGN_ID }).success).toBe(false);
  });
});
