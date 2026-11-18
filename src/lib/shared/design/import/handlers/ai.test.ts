import { describe, expect, it, vi } from "vitest";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { SNIFF_HEAD_BYTES } from "@/lib/shared/design/import/sniff";
import { invalid } from "@/lib/shared/server-utils";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }));

const { aiHandler } = await import("@/lib/shared/design/import/handlers/ai");
const { pdfHandler } = await import("@/lib/shared/design/import/handlers/pdf");

const bytesOf = (text: string): Uint8Array =>
  Uint8Array.from(text, (character) => character.charCodeAt(0));

const markerAt = (offset: number): Uint8Array => {
  const bytes = new Uint8Array(offset + 16).fill(0x20);
  bytes.set(bytesOf("%PDF-1.7"), offset);
  return bytes;
};

const headOf = (bytes: Uint8Array): Uint8Array => bytes.subarray(0, SNIFF_HEAD_BYTES);

describe("pdfHandler", () => {
  it("is the pdf extension only", () => {
    expect(pdfHandler.extensions).toEqual(["pdf"]);
  });

  it.each([0, 900, 1023])("accepts %PDF- at offset %i", (offset) => {
    expect(pdfHandler.sniff(headOf(markerAt(offset)))).toBe(true);
  });

  it.each([1024, 1500])("refuses %PDF- at offset %i", (offset) => {
    expect(pdfHandler.sniff(headOf(markerAt(offset)))).toBe(false);
  });

  it("refuses a PostScript-only file", () => {
    expect(pdfHandler.sniff(bytesOf("%!PS-Adobe-3.0\nshowpage"))).toBe(false);
  });
});

describe("aiHandler", () => {
  it("accepts a PostScript prolog and a PDF header", () => {
    expect(aiHandler.sniff(bytesOf("%!PS-Adobe-3.0\n%%prolog"))).toBe(true);
    expect(aiHandler.sniff(headOf(markerAt(900)))).toBe(true);
  });

  it("asks for PDF compatibility when a PostScript file has no PDF stream", async () => {
    const bytes = bytesOf("%!PS-Adobe-3.0\nshowpage");
    const result = await aiHandler.decode({
      file: new File([new Uint8Array(bytes)], "a.ai"),
      bytes,
      newId: () => "id",
      capacityElements: 200,
      usedBytes: 0,
    });
    expect(result).toEqual(invalid(DESIGN_IMPORT_MESSAGE.aiNotPdf));
  });
});
