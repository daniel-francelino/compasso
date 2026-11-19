import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));
vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const { gifHandler } = await import("@/lib/shared/design/import/handlers/gif");
const { avifHandler, resetAvifSupportProbe } =
  await import("@/lib/shared/design/import/handlers/avif");
const { readDesignFile } = await import("@/lib/shared/design/import/read-file");
const { readGifInfo } = await import("@/lib/shared/design/import/handlers/gif-header");
const { readAvifInfo } = await import("@/lib/shared/design/import/handlers/avif-header");
const { avifBytes, gifBytes } = await import("@/lib/shared/design/import/handlers/format-fixtures");
const { DESIGN_IMPORT_MESSAGE } = await import("@/lib/shared/design/import/messages");
const { hasAvifSignature, hasGifSignature } = await import("@/lib/shared/design/import/sniff");
const { DesignImportNoteKind } = await import("@/lib/shared/design/import/types");

const spy = vi.fn();
const getImageData = vi.fn();

class FakeCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return { drawImage: vi.fn(), getImageData };
  }
}

const stub = (width: number, height: number) => {
  spy.mockResolvedValue({ width, height, close: vi.fn() });
  getImageData.mockReturnValue({ width, height, data: new Uint8ClampedArray(width * height * 4) });
};

const run = async (
  handler: typeof gifHandler | typeof avifHandler,
  name: string,
  bytes: Uint8Array<ArrayBuffer>,
) => {
  if (handler.runsIn !== "main") throw new Error("main expected");
  return handler.decode({
    file: new File([bytes], name),
    bytes,
    newId: () => "id",
    capacityElements: 100,
    usedBytes: 0,
  });
};

const messageOf = (result: { ok: boolean; message?: string }) =>
  result.ok ? null : (result.message ?? null);

const notesOf = (result: Awaited<ReturnType<typeof run>>) =>
  result.ok && "design" in result ? result.design.notes.map((note) => note.kind) : [];

beforeEach(() => {
  vi.stubGlobal("createImageBitmap", spy);
  vi.stubGlobal("OffscreenCanvas", FakeCanvas);
  resetAvifSupportProbe();
});

afterEach(() => {
  vi.unstubAllGlobals();
  spy.mockReset();
  getImageData.mockReset();
});

describe("GIF", () => {
  it("sniffs both signatures and nothing else", () => {
    expect(hasGifSignature(gifBytes(100, 100))).toBe(true);
    expect(hasGifSignature(Uint8Array.from([71, 73, 70, 56, 56, 97]))).toBe(false);
  });

  it("imports a static GIF as one layer without notes", async () => {
    stub(100, 80);
    const result = await run(gifHandler, "a.gif", gifBytes(100, 80));
    expect(result.ok).toBe(true);
    expect(notesOf(result)).toEqual([]);
  });

  it("imports the first frame of a 3-frame GIF with animation_ignored", async () => {
    stub(100, 80);
    const result = await run(gifHandler, "a.gif", gifBytes(100, 80, { frames: 3 }));
    expect(notesOf(result)).toEqual([DesignImportNoteKind.AnimationIgnored]);
  });

  it("refuses 65535 x 65535 in a tiny file before any decode", async () => {
    const result = await run(gifHandler, "a.gif", gifBytes(65535, 65535));
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.gifTooLarge);
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses a 100 x 100 screen whose first frame is 65535 x 65535 before any decode", async () => {
    const result = await run(
      gifHandler,
      "a.gif",
      gifBytes(100, 100, { frameSize: [65535, 65535] }),
    );
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.gifTooLarge);
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses a huge frame that comes after the first two", async () => {
    const bytes = gifBytes(100, 100, { frames: 5, laterFrameSize: [65535, 65535] });
    expect(messageOf(await run(gifHandler, "a.gif", bytes))).toBe(
      DESIGN_IMPORT_MESSAGE.gifTooLarge,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses a zero size, a truncated file and a file with no frame", async () => {
    for (const bytes of [
      gifBytes(0, 10),
      gifBytes(10, 10).slice(0, 12),
      gifBytes(10, 10, { frames: 0 }),
      gifBytes(10, 10).slice(0, 26),
    ]) {
      expect(messageOf(await run(gifHandler, "a.gif", bytes))).toBe(
        DESIGN_IMPORT_MESSAGE.gifCorrupt,
      );
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("stops the block walker at its cap with one million extension blocks", () => {
    const hostile = gifBytes(10, 10, { extensionBlocks: 1_000_000 });
    expect(readGifInfo(hostile)).toBeNull();
  });

  it("maps a decoder failure to the GIF message", async () => {
    spy.mockRejectedValue(new Error("x"));
    expect(messageOf(await run(gifHandler, "a.gif", gifBytes(100, 80)))).toBe(
      DESIGN_IMPORT_MESSAGE.gifCorrupt,
    );
  });
});

describe("AVIF", () => {
  it("sniffs the major brand and the compatible brands", () => {
    expect(hasAvifSignature(avifBytes([[10, 10]]))).toBe(true);
    expect(hasAvifSignature(avifBytes([[10, 10]], { brand: "avis" }))).toBe(true);
    expect(hasAvifSignature(avifBytes([[10, 10]], { brand: "heic" }))).toBe(false);
  });

  it("reads the first ispe and notes the sequence brand", () => {
    expect(readAvifInfo(avifBytes([[100, 80]]))).toMatchObject({ width: 100, height: 80 });
    expect(readAvifInfo(avifBytes([[100, 80]], { brand: "avis" }))?.animated).toBe(true);
  });

  it("imports a valid AVIF", async () => {
    stub(100, 80);
    expect((await run(avifHandler, "a.avif", avifBytes([[100, 80]]))).ok).toBe(true);
  });

  it("refuses an ispe of 100000 x 100000 before createImageBitmap", async () => {
    const result = await run(avifHandler, "a.avif", avifBytes([[100000, 100000]]));
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.avifTooLarge);
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses a huge ispe that is not the first one", async () => {
    const result = await run(
      avifHandler,
      "a.avif",
      avifBytes([
        [10, 10],
        [100000, 100000],
      ]),
    );
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.avifTooLarge);
  });

  it("refuses a truncated meta box and a box of size zero", async () => {
    for (const bytes of [
      avifBytes([[100, 80]], { truncateMeta: true }),
      avifBytes([[100, 80]], { zeroBoxSize: true }),
      avifBytes([
        [100, 80],
        [200, 80],
      ]),
      avifBytes([[0, 10]]),
      avifBytes([]),
    ]) {
      expect(messageOf(await run(avifHandler, "a.avif", bytes))).toBe(
        DESIGN_IMPORT_MESSAGE.avifCorrupt,
      );
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("reads only the first MiB of an AVIF file, so a meta box cut by the window is corrupt", async () => {
    stub(100, 80);
    const MIB = 1024 * 1024;
    const inside = avifBytes([[100, 80]], { padding: MIB - 1024 });
    expect(inside.length).toBeLessThan(MIB);
    expect((await readDesignFile(new File([inside], "a.avif"), () => "id")).ok).toBe(true);
    const beyond = avifBytes([[100, 80]], { padding: MIB + 64 });
    expect(beyond.length).toBeGreaterThan(MIB);
    const result = await readDesignFile(new File([beyond], "a.avif"), () => "id");
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.avifCorrupt);
    expect(readAvifInfo(beyond)).not.toBeNull();
  });

  it("answers avifUnsupported, not an exception, when the browser cannot open AVIF", async () => {
    spy.mockRejectedValue(new Error("unsupported"));
    const result = await run(avifHandler, "a.avif", avifBytes([[100, 80]]));
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.avifUnsupported);
  });

  it("answers avifCorrupt when the browser opens AVIF but not this file", async () => {
    stub(1, 1);
    spy.mockRejectedValueOnce(new Error("bad"));
    const result = await run(avifHandler, "a.avif", avifBytes([[100, 80]]));
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.avifCorrupt);
  });
});
