import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));
vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const { readDesignFile } = await import("@/lib/shared/design/import/read-file");
const { aiHandler } = await import("@/lib/shared/design/import/handlers/ai");
const { pdfHandler } = await import("@/lib/shared/design/import/handlers/pdf");
const { psdHandler } = await import("@/lib/shared/design/import/handlers/psd");
const { DESIGN_IMPORT_MESSAGE } = await import("@/lib/shared/design/import/messages");
const { logError } = await import("@/lib/shared/logger");
const { invalid } = await import("@/lib/shared/server-utils");

const bytesOf = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(text, (character) => character.charCodeAt(0));

const fileOf = (name: string, bytes: Uint8Array<ArrayBuffer>): File => new File([bytes], name);

const newId = () => "id";

const messageOf = (result: Awaited<ReturnType<typeof readDesignFile>>): string | null =>
  result.ok ? null : result.message;

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(logError).mockClear();
});

describe("extension decides between ai and pdf", () => {
  it("sends the same PDF bytes to the ai handler for .ai and to the pdf handler for .pdf", async () => {
    const ai = vi.spyOn(aiHandler, "decode").mockResolvedValue(invalid("ai"));
    const pdf = vi.spyOn(pdfHandler, "decode").mockResolvedValue(invalid("pdf"));
    const bytes = bytesOf("%PDF-1.7 body");
    expect(messageOf(await readDesignFile(fileOf("a.ai", bytes), newId))).toBe("ai");
    expect(ai).toHaveBeenCalledTimes(1);
    expect(pdf).not.toHaveBeenCalled();
    expect(messageOf(await readDesignFile(fileOf("a.pdf", bytes), newId))).toBe("pdf");
    expect(pdf).toHaveBeenCalledTimes(1);
    expect(ai).toHaveBeenCalledTimes(1);
  });

  it("refuses a PostScript-only file named .pdf as a mismatch", async () => {
    const result = await readDesignFile(fileOf("a.pdf", bytesOf("%!PS-Adobe-3.0\nx")), newId);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.nameMismatch);
  });

  it("refuses random bytes named .ai as an unsupported type", async () => {
    const result = await readDesignFile(fileOf("a.ai", bytesOf("random-bytes-here")), newId);
    expect(messageOf(result)).toContain("Envie um arquivo");
  });
});

describe("polyglot 8BPS header followed by a PDF body", () => {
  const polyglot = (): Uint8Array<ArrayBuffer> => {
    const bytes = new Uint8Array(26 + 16);
    bytes.set(bytesOf("8BPS"));
    new DataView(bytes.buffer).setUint16(4, 2);
    bytes.set(bytesOf("%PDF-1.7"), 26);
    return bytes;
  };

  it("goes to the psd handler as .psd; as .pdf the real PDF marker makes it a PDF candidate, never a PSD", async () => {
    const psd = vi.spyOn(psdHandler, "decode");
    const pdf = vi.spyOn(pdfHandler, "decode").mockResolvedValue(invalid("pdf"));
    const asPsd = await readDesignFile(fileOf("a.psd", polyglot()), newId);
    expect(messageOf(asPsd)).toBe(DESIGN_IMPORT_MESSAGE.psb);
    expect(psd).toHaveBeenCalledTimes(1);
    const asPdf = await readDesignFile(fileOf("a.pdf", polyglot()), newId);
    expect(messageOf(asPdf)).toBe("pdf");
    expect(pdf).toHaveBeenCalledTimes(1);
    expect(psd).toHaveBeenCalledTimes(1);
  });
});

describe("handler failure handling", () => {
  it("passes a handler error Result through without logging", async () => {
    vi.spyOn(psdHandler, "decode").mockResolvedValue(invalid("custom"));
    const psd = new Uint8Array(26);
    psd.set(bytesOf("8BPS"));
    expect(messageOf(await readDesignFile(fileOf("a.psd", psd), newId))).toBe("custom");
    expect(logError).not.toHaveBeenCalled();
  });

  it("logs no file name, no bytes and no error message when a handler throws", async () => {
    const secret = "SECRET-CLIENT-NAME";
    vi.spyOn(psdHandler, "decode").mockRejectedValue(new Error(`bad ${secret}`));
    const psd = new Uint8Array(26);
    psd.set(bytesOf("8BPS"));
    const result = await readDesignFile(fileOf(`${secret}.psd`, psd), newId);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    const logged = JSON.stringify(vi.mocked(logError).mock.calls);
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain("8BPS");
    expect(vi.mocked(logError)).toHaveBeenCalledTimes(1);
  });
});
