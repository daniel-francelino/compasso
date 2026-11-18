import { describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));
vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const { readDesignFile } = await import("@/lib/shared/design/import/read-file");
const { psdHandler } = await import("@/lib/shared/design/import/handlers/psd");
const { DESIGN_IMPORT_MESSAGE } = await import("@/lib/shared/design/import/messages");
const { logError } = await import("@/lib/shared/logger");

const MIB = 1024 * 1024;

const bytesOf = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(text, (character) => character.charCodeAt(0));

const newId = () => "id";

const fileOf = (name: string, bytes: Uint8Array<ArrayBuffer>): File => new File([bytes], name);

const messageOf = (result: Awaited<ReturnType<typeof readDesignFile>>): string | null =>
  result.ok ? null : result.message;

const psdHeaderBytes = (version: number): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(26);
  bytes.set(bytesOf("8BPS"));
  new DataView(bytes.buffer).setUint16(4, version);
  return bytes;
};

describe("readDesignFile routing", () => {
  it("hands a PSD signature with a .psd name to the PSD handler, case-insensitive", async () => {
    const result = await readDesignFile(fileOf("arte.PSD", psdHeaderBytes(2)), newId);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.psb);
  });

  it("hands a PostScript header with a .ai name to the AI handler", async () => {
    const result = await readDesignFile(
      fileOf("arte.ai", bytesOf("%!PS-Adobe-3.0\nshowpage")),
      newId,
    );
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.aiNotPdf);
  });

  it("refuses a name that does not match the content", async () => {
    const result = await readDesignFile(fileOf("foto.psd", bytesOf("%PDF-1.7")), newId);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.nameMismatch);
    const reverse = await readDesignFile(fileOf("arte.ai", psdHeaderBytes(1)), newId);
    expect(messageOf(reverse)).toBe(DESIGN_IMPORT_MESSAGE.nameMismatch);
  });

  it("refuses an empty file and an unknown type", async () => {
    const empty = await readDesignFile(fileOf("a.psd", new Uint8Array()), newId);
    expect(messageOf(empty)).toBe(DESIGN_IMPORT_MESSAGE.empty);
    const unknown = await readDesignFile(fileOf("a.psd", bytesOf("GIF89a")), newId);
    expect(messageOf(unknown)).toBe(
      DESIGN_IMPORT_MESSAGE.unsupportedType("PSD, AI, PDF, PNG, JPEG ou WebP"),
    );
  });
});

describe("readDesignFile size gate", () => {
  it("refuses a file over the limit without reading it", async () => {
    const file = fileOf("a.psd", psdHeaderBytes(1));
    Object.defineProperty(file, "size", { value: 100 * MIB + 1 });
    const read = vi.spyOn(file, "arrayBuffer");
    const slice = vi.spyOn(file, "slice");
    const decode = vi.spyOn(psdHandler, "decode");
    const result = await readDesignFile(file, newId);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.tooLarge(100 * MIB));
    expect(messageOf(result)).toContain("100 MB");
    expect(read).not.toHaveBeenCalled();
    expect(slice).not.toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
  });
});

describe("readDesignFile handler failures", () => {
  it("maps a handler that throws to the read-failed message and logs the error name only", async () => {
    const failure = new Error("boom");
    vi.spyOn(psdHandler, "decode").mockRejectedValueOnce(failure);
    const result = await readDesignFile(fileOf("a.psd", psdHeaderBytes(1)), newId);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(vi.mocked(logError)).toHaveBeenCalledWith("import decode failed", "Error");
  });
});
