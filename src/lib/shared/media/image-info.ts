import type { ImageMime } from "@/lib/shared/media/limits";

export type ImageInfo = { mime: ImageMime; width: number; height: number };

const u16be = (b: Uint8Array, o: number) => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
const u32be = (b: Uint8Array, o: number) =>
  (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>> 0;
const u16le = (b: Uint8Array, o: number) => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, o: number) =>
  (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16);

const ascii = (b: Uint8Array, o: number, length: number) =>
  String.fromCharCode(...Array.from(b.subarray(o, o + length)));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const png = (b: Uint8Array): ImageInfo | null => {
  if (b.length < 24 || !PNG_SIGNATURE.every((value, index) => b[index] === value)) return null;
  if (ascii(b, 12, 4) !== "IHDR") return null;
  return { mime: "image/png", width: u32be(b, 16), height: u32be(b, 20) };
};

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const isStandalone = (marker: number) =>
  marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

const jpeg = (b: Uint8Array): ImageInfo | null => {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;

  let offset = 2;
  while (offset + 4 <= b.length) {
    if (b[offset] !== 0xff) return null;
    const marker = b[offset + 1] ?? 0;
    const skip = marker === 0xff ? 1 : isStandalone(marker) ? 2 : 0;
    if (skip > 0) {
      offset += skip;
      continue;
    }
    const length = u16be(b, offset + 2);
    if (length < 2) return null;
    if (SOF_MARKERS.has(marker)) {
      return offset + 9 > b.length
        ? null
        : { mime: "image/jpeg", height: u16be(b, offset + 5), width: u16be(b, offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
};

const webpLossy = (b: Uint8Array): ImageInfo | null =>
  b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a
    ? { mime: "image/webp", width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff }
    : null;

const webpLossless = (b: Uint8Array): ImageInfo | null => {
  if (b[20] !== 0x2f) return null;
  const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24);
  return { mime: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
};

const webp = (b: Uint8Array): ImageInfo | null => {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") return webpLossy(b);
  if (chunk === "VP8L") return webpLossless(b);
  if (chunk === "VP8X") {
    return { mime: "image/webp", width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  return null;
};

export const inspectImage = (bytes: Uint8Array): ImageInfo | null => {
  const info = png(bytes) ?? jpeg(bytes) ?? webp(bytes);
  if (!info || info.width <= 0 || info.height <= 0) return null;
  return info;
};

const ISO_SKIPPABLE = new Set(["free", "skip", "wide", "junk", "pnot", "uuid"]);
const ISO_STARTING = new Set(["ftyp", "moov", "mdat"]);
const ISO_BOXES_READ = 8;

const isoBoxSize = (b: Uint8Array, offset: number): number => {
  const size = u32be(b, offset);
  if (size !== 1) return size;
  return u32be(b, offset + 8) === 0 ? u32be(b, offset + 12) : Number.MAX_SAFE_INTEGER;
};

const isoVideo = (b: Uint8Array): boolean => {
  let offset = 0;
  for (let read = 0; read < ISO_BOXES_READ && offset + 8 <= b.length; read += 1) {
    const type = ascii(b, offset + 4, 4);
    if (ISO_STARTING.has(type)) return true;
    if (!ISO_SKIPPABLE.has(type)) return false;
    const size = isoBoxSize(b, offset);
    if (size < 8) return false;
    offset += size;
  }
  return false;
};

const ebmlVideo = (b: Uint8Array): boolean =>
  b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;

const aviVideo = (b: Uint8Array): boolean =>
  b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "AVI ";

const VIDEO_SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  "video/mp4": isoVideo,
  "video/x-m4v": isoVideo,
  "video/quicktime": isoVideo,
  "video/3gpp": isoVideo,
  "video/3gpp2": isoVideo,
  "video/webm": ebmlVideo,
  "video/x-matroska": ebmlVideo,
  "video/x-msvideo": aviVideo,
};

export const inspectVideoFile = (bytes: Uint8Array, mime: string): boolean =>
  VIDEO_SIGNATURES[mime]?.(bytes) ?? false;
