import { describe, expect, it } from "vitest";
import { jpegBytes, pngBytes, webpBytes } from "@/lib/shared/design/import/handlers/image-fixtures";
import {
  orientedSize,
  readImageHeader,
  readJpegHeader,
  readPngSize,
  readWebpSize,
} from "@/lib/shared/design/import/handlers/image-header";
import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { DesignImportFormat } from "@/lib/shared/design/import/types";

describe("readPngSize", () => {
  it("reads the IHDR size, also for a huge declared size in a small file", () => {
    expect(readPngSize(pngBytes(1, 1))).toEqual({ width: 1, height: 1 });
    expect(readPngSize(pngBytes(4096, 4096))).toEqual({ width: 4096, height: 4096 });
    const huge = pngBytes(65535, 65535);
    expect(huge.length).toBeLessThan(2000);
    expect(readPngSize(huge)).toEqual({ width: 65535, height: 65535 });
  });

  it("ignores trailing garbage", () => {
    expect(readPngSize(pngBytes(10, 20, { padding: 5000 }))).toEqual({ width: 10, height: 20 });
  });

  it("refuses a missing IHDR, a wrong length and a truncated header", () => {
    expect(readPngSize(pngBytes(10, 10, { chunk: "IDAT" }))).toBeNull();
    expect(readPngSize(pngBytes(10, 10, { ihdrLength: 12 }))).toBeNull();
    expect(readPngSize(pngBytes(10, 10).subarray(0, 23))).toBeNull();
    expect(readPngSize(new Uint8Array(0))).toBeNull();
    expect(readPngSize(pngBytes(0, 10))).toBeNull();
  });
});

describe("readJpegHeader", () => {
  it.each([0xc0, 0xc1, 0xc2])("finds SOF marker %i", (sof) => {
    expect(readJpegHeader(jpegBytes(640, 480, { sof }))).toEqual({
      width: 640,
      height: 480,
      orientation: 1,
    });
  });

  it("finds a SOF after 100 KB of APP segments (progressive)", () => {
    const bytes = jpegBytes(800, 600, { sof: 0xc2, padding: 100_000 });
    expect(readJpegHeader(bytes)?.width).toBe(800);
  });

  it("refuses a SOF beyond the 256 KiB window", () => {
    const bytes = jpegBytes(800, 600, { padding: DESIGN_IMPORT_LIMITS.jpegHeaderWindowBytes });
    expect(readJpegHeader(bytes)).toBeNull();
    const result = readImageHeader(bytes, DesignImportFormat.Jpeg);
    expect(!result.ok && result.message).toBe(DESIGN_IMPORT_MESSAGE.imageCorrupt);
  });

  it("does not take DHT, JPG and DAC markers for a frame header", () => {
    for (const marker of [0xc4, 0xc8, 0xcc]) {
      const decoy = [0xff, marker, 0, 5, 1, 2, 3];
      expect(readJpegHeader(jpegBytes(33, 44, { prefix: decoy }))).toEqual({
        width: 33,
        height: 44,
        orientation: 1,
      });
    }
  });

  it("terminates on segment lengths 0 and 1", () => {
    expect(readJpegHeader(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBeNull();
    expect(readJpegHeader(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 0, 0]))).toBeNull();
  });

  it("skips FF padding and restart markers", () => {
    const fill = [0xff, 0xff, 0xff, 0xd0];
    expect(readJpegHeader(jpegBytes(70, 80, { prefix: fill }))?.height).toBe(80);
  });

  it("refuses a truncated segment, a lost marker and an early scan or end", () => {
    expect(readJpegHeader(jpegBytes(70, 80).subarray(0, 10))).toBeNull();
    expect(readJpegHeader(Uint8Array.from([0xff, 0xd8, 0x12, 0x34, 0x56, 0x78]))).toBeNull();
    expect(readJpegHeader(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 4, 0, 0]))).toBeNull();
    expect(readJpegHeader(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0, 0, 0, 0]))).toBeNull();
    expect(readJpegHeader(new Uint8Array(0))).toBeNull();
  });

  it("refuses a zero-size frame without throwing", () => {
    expect(readJpegHeader(jpegBytes(0, 10))).toBeNull();
    expect(readJpegHeader(jpegBytes(10, 0))).toBeNull();
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("reads EXIF orientation %i in both byte orders", (value) => {
    for (const bigEndian of [false, true]) {
      const header = readJpegHeader(jpegBytes(400, 300, { orientation: value, bigEndian }));
      expect(header?.orientation).toBe(value);
    }
  });

  it("treats a missing, 0 or 9 orientation as 1", () => {
    expect(readJpegHeader(jpegBytes(400, 300))?.orientation).toBe(1);
    expect(readJpegHeader(jpegBytes(400, 300, { orientation: 0 }))?.orientation).toBe(1);
    expect(readJpegHeader(jpegBytes(400, 300, { orientation: 9 }))?.orientation).toBe(1);
  });

  it("keeps the default orientation when the EXIF block is cut short", () => {
    const full = jpegBytes(400, 300, { orientation: 6 });
    const header = readJpegHeader(Uint8Array.from([...full.subarray(0, 14), 0xff, 0xd9]));
    expect(header).toBeNull();
  });
});

describe("orientedSize", () => {
  it("swaps the sides for the 90 degree orientations only", () => {
    const base = { width: 4000, height: 3000, animated: false, orientationKnown: true };
    for (const orientation of [1, 2, 3, 4]) {
      expect(orientedSize({ ...base, orientation })).toEqual({ width: 4000, height: 3000 });
    }
    for (const orientation of [5, 6, 7, 8]) {
      expect(orientedSize({ ...base, orientation })).toEqual({ width: 3000, height: 4000 });
    }
  });

  it("reads the oriented size from a real EXIF 6 header", () => {
    const result = readImageHeader(
      jpegBytes(4000, 3000, { orientation: 6 }),
      DesignImportFormat.Jpeg,
    );
    expect(result.ok && orientedSize(result.header)).toEqual({ width: 3000, height: 4000 });
  });
});

describe("readWebpSize", () => {
  it("reads VP8, VP8L and VP8X sizes", () => {
    expect(readWebpSize(webpBytes("vp8", 640, 480))).toEqual({
      width: 640,
      height: 480,
      animated: false,
    });
    expect(readWebpSize(webpBytes("vp8l", 16384, 100))).toEqual({
      width: 16384,
      height: 100,
      animated: false,
    });
    expect(readWebpSize(webpBytes("vp8x", 5000, 7000))).toEqual({
      width: 5000,
      height: 7000,
      animated: false,
    });
  });

  it("flags the animation bit of VP8X", () => {
    expect(readWebpSize(webpBytes("vp8x", 100, 100, { animated: true }))?.animated).toBe(true);
  });

  it("refuses an invalid VP8X, a truncated file and an unknown chunk", () => {
    expect(readWebpSize(webpBytes("vp8x", 100, 100, { chunkSize: 9 }))).toBeNull();
    expect(readWebpSize(webpBytes("vp8", 100, 100).subarray(0, 20))).toBeNull();
    expect(readWebpSize(webpBytes("vp8", 0, 100))).toBeNull();
    expect(readWebpSize(webpBytes("vp8l", 100, 100).subarray(0, 22))).toBeNull();
    const unknown = webpBytes("vp8", 100, 100).slice();
    unknown[12] = 0x58;
    expect(readWebpSize(unknown)).toBeNull();
  });
});
