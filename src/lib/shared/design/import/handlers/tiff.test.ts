import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const { tiffBytes } = await import("@/lib/shared/design/import/handlers/format-fixtures");
const { tiffHandler } = await import("@/lib/shared/design/import/handlers/tiff");
const { TiffRefusal, readTiffInfo, workingSetBytes } =
  await import("@/lib/shared/design/import/worker/tiff-header");
const { runTiff } = await import("@/lib/shared/design/import/worker/tiff-engine");
const { runTiffJob } = await import("@/lib/shared/design/import/worker/tiff-client");
const { hasTiffSignature } = await import("@/lib/shared/design/import/sniff");
const { DESIGN_IMPORT_MESSAGE } = await import("@/lib/shared/design/import/messages");
const { DesignImportNoteKind } = await import("@/lib/shared/design/import/types");
const { DESIGN_LIMITS } = await import("@/lib/shared/design/types");

const refusalOf = (bytes: Uint8Array) => {
  const result = readTiffInfo(bytes);
  return result.ok ? null : result.refusal;
};

const utifFor = (width: number, height: number) => {
  const decodeImage = vi.fn();
  return {
    decodeImage,
    utif: {
      decode: vi.fn(() => [{ width, height }]),
      decodeImage,
      toRGBA8: vi.fn(() => new Uint8Array(width * height * 4)),
    },
  };
};

const bufferOf = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer;

describe("TIFF header pre-pass", () => {
  it("reads little and big endian classic files", () => {
    for (const bigEndian of [false, true]) {
      const result = readTiffInfo(tiffBytes(100, 80, { bigEndian }));
      expect(result.ok && result.info).toMatchObject({
        width: 100,
        height: 80,
        bitsPerSample: 8,
        samplesPerPixel: 3,
        ifdCount: 1,
      });
    }
  });

  it("sniffs both byte orders and BigTIFF, then refuses BigTIFF as unsupported", () => {
    expect(hasTiffSignature(tiffBytes(10, 10))).toBe(true);
    expect(hasTiffSignature(tiffBytes(10, 10, { bigEndian: true }))).toBe(true);
    expect(hasTiffSignature(Uint8Array.from([0x49, 0x49, 7, 0]))).toBe(false);
    expect(refusalOf(tiffBytes(10, 10, { bigTiff: true }))).toBe(TiffRefusal.Unsupported);
    expect(refusalOf(tiffBytes(10, 10, { bigTiff: true, bigEndian: true }))).toBe(
      TiffRefusal.Unsupported,
    );
  });

  it("refuses a declared side above 32768 and counts the working set", () => {
    expect(refusalOf(tiffBytes(60000, 60000))).toBe(TiffRefusal.TooLarge);
    const info = readTiffInfo(tiffBytes(1000, 1000, { bits: 16 }));
    expect(info.ok && workingSetBytes(info.info, 100)).toBe(1000 * 1000 * (6 + 8) + 200);
  });

  it("refuses an IFD loop, a pointer outside the file and a truncated file", () => {
    expect(refusalOf(tiffBytes(100, 80, { loop: true }))).toBe(TiffRefusal.Corrupt);
    const bytes = tiffBytes(100, 80);
    const outside = bytes.slice();
    outside.set([0xff, 0xff, 0xff, 0x7f], 4);
    expect(refusalOf(outside)).toBe(TiffRefusal.Corrupt);
    expect(refusalOf(bytes.slice(0, 20))).toBe(TiffRefusal.Corrupt);
    expect(refusalOf(bytes.slice(0, 4))).toBe(TiffRefusal.Corrupt);
  });

  it("caps the IFD chain at 64 and counts extra IFDs", () => {
    expect(refusalOf(tiffBytes(100, 80, { extraIfds: 100 }))).toBe(TiffRefusal.Corrupt);
    const result = readTiffInfo(tiffBytes(100, 80, { extraIfds: 3 }));
    expect(result.ok && result.info.ifdCount).toBe(4);
  });

  it("refuses more samples than BitsPerSample values (duplicate tags and counts are in tiff-real.test.ts)", () => {
    expect(refusalOf(tiffBytes(100, 80, { samples: 9 }))).toBe(TiffRefusal.Corrupt);
  });

  it("refuses strip byte counts larger than the file", () => {
    expect(refusalOf(tiffBytes(100, 80, { claimedStripBytes: 10_000_000 }))).toBe(
      TiffRefusal.Corrupt,
    );
  });

  it("refuses unsupported compression, bit depth, planar layout, tiles and photometric", () => {
    for (const options of [
      { compression: 7 },
      { bits: 4 },
      { planar: 2 },
      { tiled: true },
      { photometric: 6 },
    ]) {
      expect(refusalOf(tiffBytes(100, 80, options))).toBe(TiffRefusal.Unsupported);
    }
  });
});

describe("TIFF engine", () => {
  it("never calls decodeImage for a 60000 x 60000 header", async () => {
    const { utif, decodeImage } = utifFor(60000, 60000);
    const out = await runTiff(1, bufferOf(tiffBytes(60000, 60000)), 0, utif);
    expect(out.response).toMatchObject({ status: "error", refusal: TiffRefusal.TooLarge });
    expect(utif.decode).not.toHaveBeenCalled();
    expect(decodeImage).not.toHaveBeenCalled();
  });

  it("refuses a working set above the remaining raster budget before any decode", async () => {
    const { utif, decodeImage } = utifFor(10000, 10000);
    const out = await runTiff(1, bufferOf(tiffBytes(10000, 10000)), 0, utif);
    expect(out.response).toMatchObject({ status: "error", refusal: TiffRefusal.TooLarge });
    const small = utifFor(100, 100);
    const used = DESIGN_LIMITS.rasterBudgetBytes - 1000;
    const second = await runTiff(2, bufferOf(tiffBytes(100, 100)), used, small.utif);
    expect(second.response).toMatchObject({ status: "error", refusal: TiffRefusal.TooLarge });
    expect(decodeImage).not.toHaveBeenCalled();
    expect(small.decodeImage).not.toHaveBeenCalled();
  });

  it("decodes a small file and reports sizes, depth and page count", async () => {
    const { utif } = utifFor(100, 80);
    const out = await runTiff(7, bufferOf(tiffBytes(100, 80, { bits: 16, extraIfds: 1 })), 0, utif);
    expect(out.response).toMatchObject({
      id: 7,
      status: "result",
      width: 100,
      height: 80,
      bitsPerSample: 16,
      ifdCount: 2,
      downscaled: false,
    });
    expect(out.transfer).toHaveLength(1);
  });

  it("downscales a decode above the page side with nearest sampling", async () => {
    const { utif } = utifFor(5000, 100);
    const out = await runTiff(1, bufferOf(tiffBytes(5000, 100)), 0, utif);
    expect(out.response).toMatchObject({ status: "result", width: 4096, downscaled: true });
  });

  it("refuses a decoder whose size or buffer disagrees with the header", async () => {
    const wrongSize = utifFor(50, 50);
    const first = await runTiff(1, bufferOf(tiffBytes(100, 80)), 0, wrongSize.utif);
    expect(first.response).toMatchObject({ refusal: TiffRefusal.Corrupt });
    const shortBuffer = {
      decode: () => [{ width: 100, height: 80 }],
      decodeImage: vi.fn(),
      toRGBA8: () => new Uint8Array(4),
    };
    const second = await runTiff(1, bufferOf(tiffBytes(100, 80)), 0, shortBuffer);
    expect(second.response).toMatchObject({ refusal: TiffRefusal.Corrupt });
  });
});

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: Event) => void) | null = null;
  terminated = false;
  posted: unknown[] = [];
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }
}

const startJob = (signal?: AbortSignal, timeoutMs?: number) =>
  runTiffJob({ file: new File([new Uint8Array(8)], "a.tif"), usedBytes: 0 }, signal, timeoutMs);

const goodResponse = (extra: Record<string, unknown> = {}) => ({
  id: 0,
  status: "result",
  width: 2,
  height: 2,
  sourceWidth: 2,
  sourceHeight: 2,
  pixels: new ArrayBuffer(16),
  bitsPerSample: 8,
  cmyk: false,
  gray: false,
  downscaled: false,
  ifdCount: 1,
  ...extra,
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
});

describe("TIFF worker client", () => {
  it("accepts a valid answer and terminates the worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const job = startJob();
    FakeWorker.instances[0]?.reply(goodResponse());
    expect((await job).ok).toBe(true);
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
  });

  it("refuses an answer whose buffer length is not width times height times 4", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const job = startJob();
    FakeWorker.instances[0]?.reply(goodResponse({ pixels: new ArrayBuffer(12) }));
    const result = await job;
    expect(!result.ok && result.message).toBe(DESIGN_IMPORT_MESSAGE.tiffCorrupt);
  });

  it("refuses a malformed message and maps worker refusals to catalog texts", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const bad = startJob();
    FakeWorker.instances[0]?.reply({ nonsense: true });
    expect((await bad).ok).toBe(false);
    const refused = startJob();
    FakeWorker.instances[1]?.reply({ id: 0, status: "error", refusal: TiffRefusal.Unsupported });
    const result = await refused;
    expect(!result.ok && result.message).toBe(DESIGN_IMPORT_MESSAGE.tiffUnsupported);
  });

  it("terminates the worker on cancel and applies no late result", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const controller = new AbortController();
    const job = startJob(controller.signal);
    controller.abort();
    const result = await job;
    expect(!result.ok && result.message).toBe(DESIGN_IMPORT_MESSAGE.cancelled);
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
    FakeWorker.instances[0]?.reply(goodResponse());
  });

  it("times out and terminates", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const pending = startJob(undefined, 5000);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await pending;
    expect(!result.ok && result.message).toBe(DESIGN_IMPORT_MESSAGE.timedOut);
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
  });

  it("refuses when Workers are unavailable", async () => {
    vi.stubGlobal("Worker", undefined);
    expect((await startJob()).ok).toBe(false);
  });
});

describe("TIFF handler", () => {
  it("builds one layer with the depth, cmyk and first-page notes and metadata", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    if (tiffHandler.runsIn !== "worker") throw new Error("worker expected");
    const pending = tiffHandler.decode({
      file: new File([new Uint8Array(8)], "scan.tif"),
      newId: () => "id",
      capacityElements: 10,
      usedBytes: 0,
    });
    FakeWorker.instances[0]?.reply(
      goodResponse({
        bitsPerSample: 16,
        cmyk: true,
        ifdCount: 3,
        width: 64,
        height: 64,
        sourceWidth: 64,
        sourceHeight: 64,
        pixels: new ArrayBuffer(64 * 64 * 4),
      }),
    );
    const result = await pending;
    if (!result.ok || !("design" in result)) throw new Error("design expected");
    expect(result.design.notes.map((note) => note.kind)).toEqual([
      DesignImportNoteKind.DepthReduced,
      DesignImportNoteKind.CmykConverted,
      DesignImportNoteKind.FirstPageOnly,
    ]);
    expect(result.design.metadata?.source.colorMode).toBe("cmyk");
    expect(result.design.metadata?.source.pageCount).toBe(3);
  });

  it("has the documented extensions and run location", () => {
    expect([...tiffHandler.extensions]).toEqual(["tif", "tiff"]);
    expect(tiffHandler.runsIn).toBe("worker");
  });
});
