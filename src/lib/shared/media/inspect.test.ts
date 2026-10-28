import { describe, expect, it } from "vitest";
import { inspectImage, inspectVideoFile } from "@/lib/shared/media/image-info";
import {
  MediaKind,
  acceptFor,
  isMediaMime,
  kindOfMime,
  mimeOfFile,
} from "@/lib/shared/media/limits";
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

describe("inspectVideoFile", () => {
  const box = (type: string, size: number) => [...be32(size), ...ascii(type)];

  it("recognizes the ftyp box of the MP4 family", () => {
    const bytes = new Uint8Array([0, 0, 0, 24, ...ascii("ftypisom"), 0, 0, 2, 0]);
    for (const mime of ["video/mp4", "video/x-m4v", "video/quicktime", "video/3gpp"]) {
      expect(inspectVideoFile(bytes, mime)).toBe(true);
    }
    expect(inspectVideoFile(new Uint8Array(20), "video/mp4")).toBe(false);
  });

  it("accepts files that start with free, wide or moov boxes before ftyp", () => {
    const withFree = new Uint8Array([
      ...box("free", 16),
      ...new Array<number>(8).fill(0),
      ...box("ftyp", 16),
    ]);
    expect(inspectVideoFile(withFree, "video/mp4")).toBe(true);
    const oldQuickTime = new Uint8Array([...box("wide", 8), ...box("mdat", 100)]);
    expect(inspectVideoFile(oldQuickTime, "video/quicktime")).toBe(true);
    expect(inspectVideoFile(new Uint8Array([...box("moov", 100)]), "video/quicktime")).toBe(true);
  });

  it("refuses an unknown first box and a skip box that never ends", () => {
    expect(
      inspectVideoFile(
        new Uint8Array([...box("html", 16), ...new Array<number>(8).fill(0)]),
        "video/mp4",
      ),
    ).toBe(false);
    expect(inspectVideoFile(new Uint8Array([...box("free", 4000)]), "video/mp4")).toBe(false);
  });

  it("recognizes WebM/MKV by the EBML header and AVI by RIFF", () => {
    const ebml = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42]);
    expect(inspectVideoFile(ebml, "video/webm")).toBe(true);
    expect(inspectVideoFile(ebml, "video/x-matroska")).toBe(true);
    expect(inspectVideoFile(ebml, "video/mp4")).toBe(false);
    const avi = new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("AVI "), 0]);
    expect(inspectVideoFile(avi, "video/x-msvideo")).toBe(true);
    expect(inspectVideoFile(avi, "video/webm")).toBe(false);
  });

  it("refuses a type outside the allowlist", () => {
    expect(
      inspectVideoFile(new Uint8Array([0, 0, 0, 24, ...ascii("ftypisom")]), "video/x-flv"),
    ).toBe(false);
  });
});

describe("mimeOfFile", () => {
  it("keeps a declared type that is accepted", () => {
    expect(mimeOfFile({ name: "clip.mov", type: "video/quicktime" })).toBe("video/quicktime");
  });

  it("falls back to the extension when the browser gives an empty or generic type", () => {
    expect(mimeOfFile({ name: "WhatsApp Video 2026-10-27.mp4", type: "" })).toBe("video/mp4");
    expect(mimeOfFile({ name: "IMG_0001.MOV", type: "application/octet-stream" })).toBe(
      "video/quicktime",
    );
    expect(mimeOfFile({ name: "clip.3gp", type: "" })).toBe("video/3gpp");
    expect(mimeOfFile({ name: "photo.JPG", type: "" })).toBe("image/jpeg");
  });

  it("returns the declared type when nothing is recognized", () => {
    expect(mimeOfFile({ name: "movie.wmv", type: "video/x-ms-wmv" })).toBe("video/x-ms-wmv");
    expect(mimeOfFile({ name: "noextension", type: "" })).toBe("");
  });
});

describe("acceptFor", () => {
  it("lists MIME types and extensions so empty-type files stay selectable", () => {
    const accept = acceptFor([MediaKind.Video]).split(",");
    expect(accept).toContain("video/quicktime");
    expect(accept).toContain(".mov");
    expect(accept).not.toContain(".pdf");
  });
});

describe("mime allowlist", () => {
  it("maps each accepted type to its kind", () => {
    expect(kindOfMime("image/webp")).toBe(MediaKind.Image);
    expect(kindOfMime("video/mp4")).toBe(MediaKind.Video);
    expect(kindOfMime("video/quicktime")).toBe(MediaKind.Video);
    expect(kindOfMime("video/webm")).toBe(MediaKind.Video);
    expect(kindOfMime("application/pdf")).toBe(MediaKind.Document);
  });

  it("refuses everything else", () => {
    for (const mime of ["image/svg+xml", "text/html", "application/zip", "audio/mpeg", ""]) {
      expect(isMediaMime(mime)).toBe(false);
    }
  });
});
