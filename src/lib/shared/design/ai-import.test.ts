import { describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));

const { aiRenderSize, extractPdfBytes } = await import("@/lib/shared/design/ai-import");

const bytesOf = (text: string): Uint8Array =>
  Uint8Array.from(text, (character) => character.charCodeAt(0));

const textOf = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

describe("extractPdfBytes", () => {
  it("returns the same bytes when the file starts with a PDF header", () => {
    const bytes = bytesOf("%PDF-1.6 body");
    expect(extractPdfBytes(bytes)).toBe(bytes);
  });

  it("finds a PDF stream after a PostScript prolog", () => {
    const found = extractPdfBytes(bytesOf("%!PS-Adobe-3.0\n%%prolog\n%PDF-1.5 body"));
    expect(found === null ? null : textOf(found)).toBe("%PDF-1.5 body");
  });

  it("returns null when there is no PDF stream", () => {
    expect(extractPdfBytes(bytesOf("%!PS-Adobe-3.0\nshowpage"))).toBeNull();
  });
});

describe("aiRenderSize", () => {
  it("renders at 2x when it fits", () => {
    expect(aiRenderSize(540, 675)).toEqual({ scale: 2, width: 1080, height: 1350 });
  });

  it("never passes 4096 px", () => {
    const size = aiRenderSize(3000, 1500);
    expect(size.width).toBeLessThanOrEqual(4096);
    expect(size.height).toBeLessThanOrEqual(4096);
  });
});
