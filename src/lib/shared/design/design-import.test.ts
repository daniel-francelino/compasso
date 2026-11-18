import { describe, expect, it } from "vitest";
import {
  DESIGN_IMPORT_LIMITS,
  DESIGN_IMPORT_MESSAGE,
  DesignImportFormat,
  detectImportFormat,
  inspectImportFile,
  sizeFitsPage,
} from "@/lib/shared/design/design-import";

const bytesOf = (text: string): Uint8Array =>
  Uint8Array.from(text, (character) => character.charCodeAt(0));

describe("detectImportFormat", () => {
  it("reads the PSD signature", () => {
    expect(detectImportFormat(bytesOf("8BPS\u0000\u0001"))).toBe(DesignImportFormat.Psd);
  });

  it("reads a PDF header, also after a short preamble", () => {
    expect(detectImportFormat(bytesOf("%PDF-1.6\n"))).toBe(DesignImportFormat.Ai);
    expect(detectImportFormat(bytesOf("\n\n%PDF-1.5"))).toBe(DesignImportFormat.Ai);
  });

  it("reads the PostScript header of a legacy file", () => {
    expect(detectImportFormat(bytesOf("%!PS-Adobe-3.0 EPSF-3.0"))).toBe(DesignImportFormat.Ai);
  });

  it("refuses anything else", () => {
    expect(detectImportFormat(bytesOf("\u0089PNG\r\n"))).toBeNull();
    expect(detectImportFormat(new Uint8Array())).toBeNull();
  });
});

describe("inspectImportFile", () => {
  it("accepts a matching name and content", () => {
    expect(inspectImportFile("arte.PSD", bytesOf("8BPS"))).toEqual({
      ok: true,
      format: DesignImportFormat.Psd,
    });
    expect(inspectImportFile("arte.ai", bytesOf("%PDF-1.7"))).toEqual({
      ok: true,
      format: DesignImportFormat.Ai,
    });
  });

  it("refuses a name that does not match the content", () => {
    const result = inspectImportFile("foto.psd", bytesOf("%PDF-1.7"));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toBe(DESIGN_IMPORT_MESSAGE.nameMismatch);
  });

  it("refuses an empty file, an unknown type and an oversized file", () => {
    expect(inspectImportFile("a.psd", new Uint8Array()).ok).toBe(false);
    expect(inspectImportFile("a.psd", bytesOf("GIF89a")).ok).toBe(false);
    const huge = new Uint8Array(DESIGN_IMPORT_LIMITS.maxBytes + 1);
    huge.set(bytesOf("8BPS"));
    const result = inspectImportFile("a.psd", huge);
    expect(!result.ok && result.message).toBe(DESIGN_IMPORT_MESSAGE.tooLarge);
  });
});

describe("sizeFitsPage", () => {
  it("enforces the page limits", () => {
    expect(sizeFitsPage(1080, 1350).ok).toBe(true);
    expect(sizeFitsPage(4097, 100).ok).toBe(false);
    expect(sizeFitsPage(63, 100).ok).toBe(false);
  });
});
