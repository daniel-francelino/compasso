import { describe, expect, it } from "vitest";
import { buildMetadata } from "@/lib/shared/design/import/metadata";
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
  it("accepts a design id and metadata built by the client", () => {
    expect(
      recordDesignImportSchema.safeParse({ id: DESIGN_ID, metadata: metadata() }).success,
    ).toBe(true);
  });

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
