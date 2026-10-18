import { describe, expect, it } from "vitest";
import { inspectImage, inspectMp4 } from "@/lib/shared/media/image-info";
import { MediaKind, isMediaMime, kindOfMime } from "@/lib/shared/media/limits";
import { inspectPdf } from "@/lib/shared/media/pdf-info";

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const be32 = (value: number) => [
  (value >>> 24) & 255,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];

const pngBytes = (width: number, height: number) =>
  new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...be32(13),
    ...ascii("IHDR"),
    ...be32(width),
    ...be32(height),
    8,
    6,
    0,
    0,
    0,
  ]);

const jpegBytes = (width: number, height: number) =>
  new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 255,
    height & 255,
    (width >> 8) & 255,
    width & 255,
    0x01,
    0x01,
    0x11,
    0x00,
  ]);

describe("inspectImage", () => {
  it("reads PNG dimensions from the header", () => {
    expect(inspectImage(pngBytes(800, 600))).toEqual({
      mime: "image/png",
      width: 800,
      height: 600,
    });
  });

  it("reads JPEG dimensions from the first frame marker", () => {
    expect(inspectImage(jpegBytes(1024, 768))).toEqual({
      mime: "image/jpeg",
      width: 1024,
      height: 768,
    });
  });

  it("refuses bytes that only claim to be an image", () => {
    expect(
      inspectImage(new Uint8Array(ascii("<html><script>alert(1)</script></html>"))),
    ).toBeNull();
    expect(inspectImage(new Uint8Array(40))).toBeNull();
  });

  it("refuses a zero-sized image", () => {
    expect(inspectImage(pngBytes(0, 10))).toBeNull();
  });
});

describe("inspectPdf", () => {
  it("accepts a PDF with header and end marker", () => {
    const bytes = new Uint8Array(ascii("%PDF-1.7\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF"));
    expect(inspectPdf(bytes)).toEqual({ mime: "application/pdf", pages: 1 });
  });

  it("refuses a file without the end marker or the header", () => {
    expect(inspectPdf(new Uint8Array(ascii("%PDF-1.7 truncated")))).toBeNull();
    expect(inspectPdf(new Uint8Array(ascii("not a pdf %%EOF")))).toBeNull();
  });
});

describe("inspectMp4", () => {
  it("recognizes the ftyp box", () => {
    const bytes = new Uint8Array([0, 0, 0, 24, ...ascii("ftypisom"), 0, 0, 2, 0]);
    expect(inspectMp4(bytes)).toBe(true);
    expect(inspectMp4(new Uint8Array(20))).toBe(false);
  });
});

describe("mime allowlist", () => {
  it("maps each accepted type to its kind", () => {
    expect(kindOfMime("image/webp")).toBe(MediaKind.Image);
    expect(kindOfMime("video/mp4")).toBe(MediaKind.Video);
    expect(kindOfMime("application/pdf")).toBe(MediaKind.Document);
  });

  it("refuses everything else", () => {
    for (const mime of ["image/svg+xml", "text/html", "application/zip", "audio/mpeg", ""]) {
      expect(isMediaMime(mime)).toBe(false);
    }
  });
});
