import { describe, expect, it } from "vitest";
import {
  SNIFF_HEAD_BYTES,
  extensionOf,
  findPdfStart,
  hasPdfContent,
  hasPsdSignature,
  importBaseName,
} from "@/lib/shared/design/import/sniff";

const bytesOf = (text: string): Uint8Array =>
  Uint8Array.from(text, (character) => character.charCodeAt(0));

const markerAt = (offset: number): Uint8Array => {
  const bytes = new Uint8Array(offset + 16).fill(0x20);
  bytes.set(bytesOf("%PDF-1.7"), offset);
  return bytes;
};

const headOf = (bytes: Uint8Array): Uint8Array => bytes.subarray(0, SNIFF_HEAD_BYTES);

describe("hasPsdSignature", () => {
  it("reads the PSD signature, any version", () => {
    expect(hasPsdSignature(bytesOf("8BPS\u0000\u0001"))).toBe(true);
    expect(hasPsdSignature(bytesOf("8BPS\u0000\u0002"))).toBe(true);
  });

  it("refuses anything else", () => {
    expect(hasPsdSignature(bytesOf("8BP"))).toBe(false);
    expect(hasPsdSignature(bytesOf("\u0089PNG\r\n"))).toBe(false);
    expect(hasPsdSignature(new Uint8Array())).toBe(false);
  });
});

describe("hasPdfContent", () => {
  it("counts a PDF header that starts before byte 1024", () => {
    expect(hasPdfContent(headOf(markerAt(0)))).toBe(true);
    expect(hasPdfContent(headOf(markerAt(5)))).toBe(true);
    expect(hasPdfContent(headOf(markerAt(900)))).toBe(true);
    expect(hasPdfContent(headOf(markerAt(1023)))).toBe(true);
  });

  it("refuses a PDF header that starts at byte 1024 or later", () => {
    expect(hasPdfContent(headOf(markerAt(1024)))).toBe(false);
    expect(hasPdfContent(headOf(markerAt(1500)))).toBe(false);
  });

  it("reads the PostScript header of a legacy file", () => {
    expect(hasPdfContent(bytesOf("%!PS-Adobe-3.0 EPSF-3.0"))).toBe(true);
  });

  it("refuses anything else", () => {
    expect(hasPdfContent(bytesOf("GIF89a"))).toBe(false);
    expect(hasPdfContent(new Uint8Array())).toBe(false);
  });
});

describe("findPdfStart", () => {
  it("returns the first marker offset, bounded by the limit", () => {
    expect(findPdfStart(markerAt(3))).toBe(3);
    expect(findPdfStart(markerAt(2000))).toBe(2000);
    expect(findPdfStart(markerAt(2000), 1024)).toBeNull();
    expect(findPdfStart(markerAt(1023), 1024)).toBe(1023);
  });

  it("does not read a marker cut by the end of the bytes", () => {
    expect(findPdfStart(bytesOf("xx%PDF"))).toBeNull();
    expect(findPdfStart(new Uint8Array())).toBeNull();
  });

  it("returns the first of several markers", () => {
    expect(findPdfStart(bytesOf("a%PDF-1 b%PDF-2"))).toBe(1);
  });
});

describe("file names", () => {
  it("reads the extension in lower case", () => {
    expect(extensionOf("Arte.PSD")).toBe("psd");
    expect(extensionOf("a.b.ai")).toBe("ai");
    expect(extensionOf("semextensao")).toBe("");
  });

  it("drops the extension and trims the base name", () => {
    expect(importBaseName("  capa final .ai")).toBe("capa final");
    expect(importBaseName(".hidden")).toBe(".hidden");
    expect(importBaseName("sem")).toBe("sem");
  });
});
