import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));
vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const { decodeImage, planImage } = await import("@/lib/shared/design/import/handlers/image");
const { jpegBytes, pngBytes, webpBytes } =
  await import("@/lib/shared/design/import/handlers/image-fixtures");
const { readImageHeader } = await import("@/lib/shared/design/import/handlers/image-header");
const { DESIGN_IMPORT_MESSAGE } = await import("@/lib/shared/design/import/messages");
const { DESIGN_IMPORT_LIMITS } = await import("@/lib/shared/design/import/limits");
const { readDesignFile } = await import("@/lib/shared/design/import/read-file");
const { DesignImportFormat, DesignImportKind, DesignImportNoteKind } =
  await import("@/lib/shared/design/import/types");
const { DESIGN_LIMITS, DesignElementKind } = await import("@/lib/shared/design/types");
const { rasterBytes } = await import("@/lib/shared/design/raster-store");

const MIB = 1024 * 1024;

type Decode = { width: number; height: number; close: () => void };

const createImageBitmapSpy = vi.fn();
const getImageData = vi.fn();
const drawImage = vi.fn();

class FakeOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return { drawImage, getImageData };
  }
}

const bitmapOf = (width: number, height: number): Decode => ({ width, height, close: vi.fn() });

const pixelsOf = (width: number, height: number) => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4),
});

const newId = () => "layer-1";

const inputOf = (name: string, bytes: Uint8Array<ArrayBuffer>, usedBytes = 0) => ({
  file: new File([bytes], name),
  bytes,
  newId,
  capacityElements: 100,
  usedBytes,
});

const stubDecode = (width: number, height: number, bitmap = bitmapOf(width, height)): Decode => {
  createImageBitmapSpy.mockResolvedValue(bitmap);
  getImageData.mockReturnValue(pixelsOf(width, height));
  return bitmap;
};

const messageOf = (result: { ok: boolean; message?: string }): string | null =>
  result.ok ? null : (result.message ?? null);

beforeEach(() => {
  vi.stubGlobal("createImageBitmap", createImageBitmapSpy);
  vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
});

afterEach(() => {
  vi.unstubAllGlobals();
  createImageBitmapSpy.mockReset();
  getImageData.mockReset();
  drawImage.mockReset();
});

describe("pre-decode checks (no real decoder runs in the node test environment)", () => {
  it("never calls createImageBitmap for a 65535 x 65535 PNG header in a 1 KB file", async () => {
    const bytes = pngBytes(65535, 65535);
    expect(bytes.length).toBeLessThan(1100);
    const result = await decodeImage(DesignImportFormat.Png, inputOf("a.png", bytes));
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.imageTooLarge(65535, 65535));
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it("side limit alone: 16385 x 100 is refused (about 6 MB, well under the byte budget) and 16384 x 100 passes", async () => {
    expect(rasterBytes(16385, 100)).toBeLessThan(DESIGN_LIMITS.rasterBudgetBytes);
    const over = await decodeImage(DesignImportFormat.Png, inputOf("a.png", pngBytes(16385, 100)));
    expect(messageOf(over)).toBe(DESIGN_IMPORT_MESSAGE.imageTooLarge(16385, 100));
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
    stubDecode(4096, 25);
    const ok = await decodeImage(DesignImportFormat.Png, inputOf("a.png", pngBytes(16384, 100)));
    expect(ok.ok).toBe(true);
  });

  it("byte budget alone: sides within the limit, refused only when 4 * width * height passes the budget", () => {
    const maxSide = DESIGN_IMPORT_LIMITS.maxLayerSide;
    const budgetPixels = DESIGN_LIMITS.rasterBudgetBytes / 4;
    const height = Math.floor(budgetPixels / maxSide);
    expect(maxSide * height * 4).toBe(DESIGN_LIMITS.rasterBudgetBytes);
    const planOf = (width: number, tall: number, used = 0) =>
      planImage(
        {
          width,
          height: tall,
          orientation: 1,
          orientationKnown: true,
          animated: false,
        },
        used,
      );
    expect(planOf(maxSide, height).ok).toBe(true);
    expect(messageOf(planOf(maxSide, height + 1))).toBe(
      DESIGN_IMPORT_MESSAGE.imageTooLarge(maxSide, height + 1),
    );
  });

  it("budget boundary with the store: fits exactly at the remaining budget and refuses one pixel more", () => {
    const side = 1024;
    const bytes = rasterBytes(side, side);
    const header = {
      width: side,
      height: side,
      orientation: 1,
      orientationKnown: true,
      animated: false,
    };
    expect(planImage(header, DESIGN_LIMITS.rasterBudgetBytes - bytes).ok).toBe(true);
    expect(messageOf(planImage(header, DESIGN_LIMITS.rasterBudgetBytes - bytes + 1))).toBe(
      DESIGN_IMPORT_MESSAGE.memory,
    );
  });

  it("refuses 4096 x 4096 when the store already holds 480 MiB, before decoding", async () => {
    const result = await decodeImage(
      DesignImportFormat.Png,
      inputOf("a.png", pngBytes(4096, 4096), 480 * MIB),
    );
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.memory);
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it("refuses a declared size above the whole raster budget although each side is small enough", async () => {
    const side = Math.ceil(Math.sqrt(DESIGN_LIMITS.rasterBudgetBytes / 4)) + 1;
    const result = await decodeImage(
      DesignImportFormat.Png,
      inputOf("a.png", pngBytes(side, side)),
    );
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.imageTooLarge(side, side));
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it("checks both orders against the side limit", async () => {
    const wide = await decodeImage(DesignImportFormat.Png, inputOf("a.png", pngBytes(20000, 100)));
    expect(messageOf(wide)).toBe(DESIGN_IMPORT_MESSAGE.imageTooLarge(20000, 100));
    const tallPng = await decodeImage(
      DesignImportFormat.Png,
      inputOf("a.png", pngBytes(100, 20000)),
    );
    expect(messageOf(tallPng)).toBe(DESIGN_IMPORT_MESSAGE.imageTooLarge(100, 20000));
    const rotated = await decodeImage(
      DesignImportFormat.Jpeg,
      inputOf("a.jpg", jpegBytes(100, 20000, { orientation: 6 })),
    );
    expect(messageOf(rotated)).toBe(DESIGN_IMPORT_MESSAGE.imageTooLarge(100, 20000));
    const straight = await decodeImage(
      DesignImportFormat.Jpeg,
      inputOf("a.jpg", jpegBytes(20000, 100, { orientation: 1 })),
    );
    expect(messageOf(straight)).toBe(DESIGN_IMPORT_MESSAGE.imageTooLarge(20000, 100));
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it("refuses an unreadable header without decoding", async () => {
    const result = await decodeImage(
      DesignImportFormat.Jpeg,
      inputOf("a.jpg", Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0, 0, 0, 0])),
    );
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.imageCorrupt);
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it("refuses sides below the page minimum and accepts exactly the minimum", async () => {
    for (const [width, height] of [
      [63, 500],
      [500, 63],
      [1, 1],
    ] as const) {
      const result = await decodeImage(
        DesignImportFormat.Png,
        inputOf("a.png", pngBytes(width, height)),
      );
      expect(messageOf(result)).toBe(
        DESIGN_IMPORT_MESSAGE.canvasTooSmall(DESIGN_IMPORT_LIMITS.minPageSide),
      );
    }
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
    stubDecode(64, 64);
    const ok = await decodeImage(DesignImportFormat.Png, inputOf("a.png", pngBytes(64, 64)));
    expect(ok.ok).toBe(true);
  });

  it("applies the minimum after the EXIF swap", () => {
    const jpeg = readImageHeader(jpegBytes(500, 63, { orientation: 6 }), DesignImportFormat.Jpeg);
    expect(jpeg.ok && messageOf(planImage(jpeg.header, 0))).toBe(
      DESIGN_IMPORT_MESSAGE.canvasTooSmall(DESIGN_IMPORT_LIMITS.minPageSide),
    );
  });
});

describe("decodeImage", () => {
  it("decodes a valid PNG once with from-image orientation, closes the bitmap, one raster layer", async () => {
    const bitmap = stubDecode(100, 100);
    const result = await decodeImage(
      DesignImportFormat.Png,
      inputOf("Meu Logo.png", pngBytes(100, 100)),
    );
    expect(createImageBitmapSpy).toHaveBeenCalledTimes(1);
    expect(createImageBitmapSpy.mock.calls[0]?.[1]).toEqual({ imageOrientation: "from-image" });
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(result.ok && result.kind).toBe(DesignImportKind.Image);
    if (!result.ok) throw new Error("expected ok");
    expect(result.design.format).toBe(DesignImportFormat.Png);
    expect(result.design.elements).toHaveLength(1);
    expect(result.design.elements[0]?.kind).toBe(DesignElementKind.Raster);
    expect(result.design.elements[0]?.name).toBe("Meu Logo");
    expect(result.design.buffers.get("layer-1")?.width).toBe(100);
    expect(result.design.notes).toEqual([]);
    expect([result.design.width, result.design.height]).toEqual([100, 100]);
  });

  it("attaches metadata with dimensions, format and rgb, and no file name", async () => {
    stubDecode(100, 100);
    const result = await decodeImage(
      DesignImportFormat.Png,
      inputOf("Segredo Pessoal.png", pngBytes(100, 100)),
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.design.metadata).toMatchObject({
      source: { format: "png", colorMode: "rgb", bitsPerChannel: null, pageCount: null },
      dimensions: { sourceWidth: 100, sourceHeight: 100, pageWidth: 100, pageHeight: 100 },
      layers: [],
    });
    expect(JSON.stringify(result.design.metadata)).not.toContain("Segredo");
  });

  it("caps and sanitizes the layer name from the file name", async () => {
    stubDecode(100, 100);
    const bidi = String.fromCharCode(0x202e);
    const name = `${bidi}${"x".repeat(200)}.png`;
    const result = await decodeImage(DesignImportFormat.Png, inputOf(name, pngBytes(100, 100)));
    if (!result.ok) throw new Error("expected ok");
    const layerName = result.design.elements[0]?.name ?? "";
    expect(layerName).toBe("x".repeat(DESIGN_LIMITS.layerNameMax));
  });

  it("keeps an emoji at position 80 whole instead of cutting a surrogate pair", async () => {
    stubDecode(100, 100);
    const emoji = String.fromCodePoint(0x1f600);
    const name = "a".repeat(79) + emoji + "tail.png";
    const result = await decodeImage(DesignImportFormat.Png, inputOf(name, pngBytes(100, 100)));
    if (!result.ok) throw new Error("expected ok");
    const layerName = result.design.elements[0]?.name ?? "";
    expect(layerName.endsWith(emoji)).toBe(true);
    expect(layerName).not.toMatch(/\p{Cs}/u);
  });

  it("downscales an 8000 x 4000 image with resize options and notes it", async () => {
    stubDecode(4096, 2048);
    const result = await decodeImage(
      DesignImportFormat.Png,
      inputOf("a.png", pngBytes(8000, 4000)),
    );
    expect(createImageBitmapSpy.mock.calls[0]?.[1]).toEqual({
      imageOrientation: "from-image",
      resizeWidth: 4096,
      resizeHeight: 2048,
      resizeQuality: "high",
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.design.notes).toEqual([{ kind: DesignImportNoteKind.Downscaled, count: 1 }]);
    expect([result.design.width, result.design.height]).toEqual([4096, 2048]);
  });

  it("closes the bitmap when getImageData throws and reports the image as corrupt", async () => {
    const bitmap = stubDecode(100, 100);
    getImageData.mockImplementation(() => {
      throw new Error("boom");
    });
    const result = await decodeImage(DesignImportFormat.Png, inputOf("a.png", pngBytes(100, 100)));
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.imageCorrupt);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("reports a rejected createImageBitmap (CMYK or truncated JPEG) as corrupt without throwing", async () => {
    createImageBitmapSpy.mockRejectedValue(new Error("InvalidStateError"));
    const result = await decodeImage(
      DesignImportFormat.Jpeg,
      inputOf("a.jpg", jpegBytes(300, 300, { sof: 0xc0 })),
    );
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.imageCorrupt);
  });

  it("discards the result when the decoded size differs from the declared size", async () => {
    const bitmap = stubDecode(101, 100);
    const result = await decodeImage(DesignImportFormat.Png, inputOf("a.png", pngBytes(100, 100)));
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.imageCorrupt);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(getImageData).not.toHaveBeenCalled();
  });

  it("discards a getImageData result whose size differs from the bitmap", async () => {
    stubDecode(100, 100);
    getImageData.mockReturnValue(pixelsOf(100, 99));
    const result = await decodeImage(DesignImportFormat.Png, inputOf("a.png", pngBytes(100, 100)));
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.imageCorrupt);
  });

  it("expects the swapped size for a JPEG with EXIF 6 and refuses the unswapped decode", async () => {
    const bytes = jpegBytes(400, 300, { orientation: 6 });
    stubDecode(300, 400);
    const ok = await decodeImage(DesignImportFormat.Jpeg, inputOf("a.jpg", bytes));
    expect(ok.ok && [ok.design.width, ok.design.height]).toEqual([300, 400]);
    stubDecode(400, 300);
    const wrong = await decodeImage(DesignImportFormat.Jpeg, inputOf("a.jpg", bytes));
    expect(messageOf(wrong)).toBe(DESIGN_IMPORT_MESSAGE.imageCorrupt);
  });

  it("imports the first frame of an animated WebP and notes the animation", async () => {
    stubDecode(200, 100);
    const result = await decodeImage(
      DesignImportFormat.Webp,
      inputOf("a.webp", webpBytes("vp8x", 200, 100, { animated: true })),
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.design.notes).toEqual([
      { kind: DesignImportNoteKind.AnimationIgnored, count: 1 },
    ]);
  });

  it("returns a cancelled message when the signal is already aborted and does not wait", async () => {
    createImageBitmapSpy.mockReturnValue(new Promise(() => undefined));
    const controller = new AbortController();
    controller.abort();
    const result = await decodeImage(DesignImportFormat.Png, {
      ...inputOf("a.png", pngBytes(100, 100)),
      signal: controller.signal,
    });
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.cancelled);
  });

  it("gives up after the time budget when createImageBitmap never settles", async () => {
    vi.useFakeTimers();
    createImageBitmapSpy.mockReturnValue(new Promise(() => undefined));
    const pending = decodeImage(DesignImportFormat.Png, inputOf("a.png", pngBytes(100, 100)));
    await vi.advanceTimersByTimeAsync(DESIGN_IMPORT_LIMITS.workerTimeoutMs - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(messageOf(await pending)).toBe(DESIGN_IMPORT_MESSAGE.timedOut);
    vi.useRealTimers();
  });

  it("cancels an in-flight createImageBitmap when the signal aborts", async () => {
    createImageBitmapSpy.mockReturnValue(new Promise(() => undefined));
    const controller = new AbortController();
    const pending = decodeImage(DesignImportFormat.Png, {
      ...inputOf("a.png", pngBytes(100, 100)),
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(createImageBitmapSpy).toHaveBeenCalledTimes(1));
    controller.abort();
    expect(messageOf(await pending)).toBe(DESIGN_IMPORT_MESSAGE.cancelled);
  });

  it("falls back to a document canvas when OffscreenCanvas is unavailable", async () => {
    vi.stubGlobal("OffscreenCanvas", undefined);
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage, getImageData }) };
    vi.stubGlobal("document", { createElement: () => canvas });
    stubDecode(100, 100);
    const result = await decodeImage(DesignImportFormat.Png, inputOf("a.png", pngBytes(100, 100)));
    expect(result.ok).toBe(true);
    expect(canvas.width).toBe(0);
  });
});

describe("planImage", () => {
  it("never upscales and keeps small images untouched", () => {
    const header = readImageHeader(pngBytes(500, 300), DesignImportFormat.Png);
    if (!header.ok) throw new Error("expected ok");
    const planned = planImage(header.header, 0);
    expect(planned.ok && planned.plan.target).toEqual({ width: 500, height: 300 });
    expect(planned.ok && planned.plan.downscaled).toBe(false);
  });

  it("keeps the aspect ratio when scaling down a tall image", () => {
    const header = readImageHeader(pngBytes(4000, 12000), DesignImportFormat.Png);
    if (!header.ok) throw new Error("expected ok");
    const planned = planImage(header.header, 0);
    expect(planned.ok && planned.plan.target).toEqual({ width: 1365, height: 4096 });
  });
});

describe("routing through readDesignFile (extension and content)", () => {
  const fileOf = (name: string, bytes: Uint8Array<ArrayBuffer>): File => new File([bytes], name);

  it("refuses a .png that holds JPEG, PSD, PDF or other content as a mismatch", async () => {
    const psd = new Uint8Array(26);
    psd.set([0x38, 0x42, 0x50, 0x53]);
    const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    for (const bytes of [jpegBytes(100, 100), psd, pdf]) {
      const result = await readDesignFile(fileOf("a.png", bytes), newId);
      expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.nameMismatch);
    }
    const empty = await readDesignFile(fileOf("a.png", new Uint8Array(0)), newId);
    expect(messageOf(empty)).toBe(DESIGN_IMPORT_MESSAGE.empty);
    const wrongTag = webpBytes("vp8", 100, 100).slice();
    wrongTag.set([0x57, 0x41, 0x56, 0x45], 8);
    const wave = await readDesignFile(fileOf("a.webp", wrongTag), newId);
    expect(wave.ok).toBe(false);
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it("accepts .jpg, .jpeg, .JPG and .JPEG for JPEG content and .PNG for PNG", async () => {
    for (const name of ["a.jpg", "a.jpeg", "a.JPG", "a.JPEG"]) {
      stubDecode(100, 100);
      const result = await readDesignFile(fileOf(name, jpegBytes(100, 100)), newId);
      expect(result.ok && result.design.format).toBe(DesignImportFormat.Jpeg);
    }
    stubDecode(100, 100);
    const png = await readDesignFile(fileOf("a.PNG", pngBytes(100, 100)), newId);
    expect(png.ok && png.design.format).toBe(DesignImportFormat.Png);
    stubDecode(100, 100);
    const webp = await readDesignFile(fileOf("a.webp", webpBytes("vp8", 100, 100)), newId);
    expect(webp.ok && webp.design.format).toBe(DesignImportFormat.Webp);
  });

  it("refuses a .png over 50 MiB before reading it", async () => {
    const file = fileOf("a.png", pngBytes(100, 100));
    Object.defineProperty(file, "size", { value: 51 * MIB });
    const result = await readDesignFile(file, newId);
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.tooLarge(50 * MIB));
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it("passes the used bytes of the context to the budget check", async () => {
    const result = await readDesignFile(fileOf("a.png", pngBytes(4096, 4096)), newId, {
      capacityElements: 10,
      usedBytes: 480 * MIB,
    });
    expect(messageOf(result)).toBe(DESIGN_IMPORT_MESSAGE.memory);
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });
});
