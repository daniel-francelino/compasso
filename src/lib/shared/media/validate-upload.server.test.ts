import { describe, expect, it } from "vitest";
import { validateUploadedVersion } from "@/lib/shared/media/validate-upload.server";
import type { ServerStorage } from "@/lib/shared/storage/types";

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const be32 = (value: number) => [
  (value >>> 24) & 255,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];

const png = (width: number, height: number, extra = 0) =>
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
    ...new Array<number>(extra).fill(0),
  ]);

const fakeStorage = (
  objects: Record<string, Uint8Array>,
  checksum: string | null = "a".repeat(64),
  contentType: string | null = "image/png",
): ServerStorage => ({
  createUploadTarget: async () => null,
  signUrls: async () => new Map(),
  stat: async (path) => {
    const object = objects[path];
    return object ? { size: object.length, contentType } : null;
  },
  readRange: async (path, start, end) => objects[path]?.slice(start, end + 1) ?? null,
  sha256: async () => checksum,
  list: async () => ({ objects: [], truncated: false }),
  remove: async () => ({ ok: true }),
  copyToPublic: async () => ({ ok: true }),
  removePublic: async () => ({ ok: true }),
});

const imageVersion = (original: Uint8Array) => ({
  storageKey: "orig",
  thumbKey: "orig-thumb",
  displayKey: "orig-display",
  mimeType: "image/png",
  sizeBytes: original.length,
});

describe("validateUploadedVersion", () => {
  it("accepts a real image and counts its copies", async () => {
    const original = png(800, 600);
    const thumb = png(400, 300);
    const result = await validateUploadedVersion(
      fakeStorage({ orig: original, "orig-thumb": thumb }),
      imageVersion(original),
    );
    expect(result).toMatchObject({
      ok: true,
      width: 800,
      height: 600,
      derivativeBytes: thumb.length,
    });
  });

  it("refuses a size different from the declared one without reading the content", async () => {
    const original = png(10, 10);
    const result = await validateUploadedVersion(fakeStorage({ orig: original }), {
      ...imageVersion(original),
      sizeBytes: original.length + 1,
    });
    expect(result).toEqual({ ok: false, code: "upload_size_mismatch" });
  });

  it("refuses a file that only declares to be an image", async () => {
    const original = new Uint8Array(ascii("<html><script>alert(1)</script></html>"));
    const result = await validateUploadedVersion(
      fakeStorage({ orig: original }),
      imageVersion(original),
    );
    expect(result).toEqual({ ok: false, code: "upload_content_mismatch" });
  });

  it("refuses an image whose real type differs from the declared one", async () => {
    const original = png(10, 10);
    const result = await validateUploadedVersion(fakeStorage({ orig: original }), {
      ...imageVersion(original),
      mimeType: "image/jpeg",
    });
    expect(result).toEqual({ ok: false, code: "upload_content_mismatch" });
  });

  it("refuses an image above the pixel limit", async () => {
    const original = png(9000, 9000);
    const result = await validateUploadedVersion(
      fakeStorage({ orig: original }),
      imageVersion(original),
    );
    expect(result).toEqual({ ok: false, code: "upload_content_mismatch" });
  });

  it("refuses a reduced copy that is not an image or is too large", async () => {
    const original = png(800, 600);
    const notImage = await validateUploadedVersion(
      fakeStorage({
        orig: original,
        "orig-thumb": new Uint8Array(ascii("not an image at all, sorry")),
      }),
      imageVersion(original),
    );
    expect(notImage).toEqual({ ok: false, code: "upload_content_mismatch" });

    const huge = await validateUploadedVersion(
      fakeStorage({ orig: original, "orig-display": png(1600, 900, 2 * 1024 * 1024) }),
      imageVersion(original),
    );
    expect(huge).toEqual({ ok: false, code: "upload_content_mismatch" });
  });

  it("validates a PDF by header and end marker", async () => {
    const good = new Uint8Array(ascii("%PDF-1.7\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF"));
    const version = (bytes: Uint8Array) => ({
      storageKey: "doc",
      thumbKey: null,
      displayKey: null,
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
    });
    expect(
      await validateUploadedVersion(
        fakeStorage({ doc: good }, undefined, "application/pdf"),
        version(good),
      ),
    ).toMatchObject({ ok: true });

    const truncated = new Uint8Array(ascii("%PDF-1.7 truncated"));
    expect(
      await validateUploadedVersion(fakeStorage({ doc: truncated }), version(truncated)),
    ).toEqual({
      ok: false,
      code: "upload_content_mismatch",
    });
  });

  it("refuses a file stored with a different content type than declared (served-as-HTML risk)", async () => {
    const original = png(10, 10);
    const result = await validateUploadedVersion(
      fakeStorage({ orig: original }, undefined, "text/html"),
      imageVersion(original),
    );
    expect(result).toEqual({ ok: false, code: "upload_content_mismatch" });
  });

  it("reports an unavailable storage when the checksum cannot be computed", async () => {
    const original = png(10, 10);
    const result = await validateUploadedVersion(
      fakeStorage({ orig: original }, null),
      imageVersion(original),
    );
    expect(result).toEqual({ ok: false, code: "storage_unavailable" });
  });
});
