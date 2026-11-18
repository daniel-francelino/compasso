import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { startsWith } from "@/lib/shared/design/import/sniff";
import { DesignImportFormat } from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

export type ImageHeader = {
  width: number;
  height: number;
  orientation: number;
  animated: boolean;
  orientationKnown: boolean;
};

type Size = { width: number; height: number };
type WebpSize = Size & { animated: boolean };

const DEFAULT_ORIENTATION = 1;
const MAX_ORIENTATION = 8;
const FIRST_SWAPPED_ORIENTATION = 5;

const PNG_IHDR_LENGTH_OFFSET = 8;
const PNG_IHDR_TYPE_OFFSET = 12;
const PNG_IHDR_WIDTH_OFFSET = 16;
const PNG_IHDR_HEIGHT_OFFSET = 20;
const PNG_IHDR_MIN_BYTES = 24;
const PNG_IHDR_LENGTH = 13;

const JPEG_MARKER_PREFIX = 0xff;
const JPEG_MARKER_STUFFED = 0x00;
const JPEG_MARKER_TEM = 0x01;
const JPEG_MARKER_RST_FIRST = 0xd0;
const JPEG_MARKER_RST_LAST = 0xd7;
const JPEG_MARKER_SOI = 0xd8;
const JPEG_MARKER_EOI = 0xd9;
const JPEG_MARKER_SOS = 0xda;
const JPEG_MARKER_APP1 = 0xe1;
const JPEG_MARKER_SOF_FIRST = 0xc0;
const JPEG_MARKER_SOF_LAST = 0xcf;
const JPEG_NOT_SOF = [0xc4, 0xc8, 0xcc];
const JPEG_FIRST_MARKER_OFFSET = 2;
const JPEG_SOF_MIN_LENGTH = 8;
const JPEG_SEGMENT_HEADER_BYTES = 4;
const JPEG_LENGTH_FIELD_BYTES = 2;
const JPEG_SOF_HEIGHT_OFFSET = 5;
const JPEG_SOF_WIDTH_OFFSET = 7;

const EXIF_TAG = "Exif";
const EXIF_PREFIX_BYTES = 6;
const TIFF_LITTLE = "II";
const TIFF_BIG = "MM";
const TIFF_MAGIC = 42;
const TIFF_HEADER_BYTES = 8;
const TIFF_ENTRY_BYTES = 12;
const TIFF_ORIENTATION_TAG = 0x0112;
const TIFF_TYPE_SHORT = 3;
const TIFF_VALUE_OFFSET = 8;

const WEBP_CHUNK_TYPE_OFFSET = 12;
const WEBP_CHUNK_SIZE_OFFSET = 16;
const WEBP_CHUNK_DATA_OFFSET = 20;
const WEBP_VP8_MIN_BYTES = 30;
const WEBP_VP8_START_CODE = [0x9d, 0x01, 0x2a];
const WEBP_VP8_START_CODE_OFFSET = 23;
const WEBP_VP8_WIDTH_OFFSET = 26;
const WEBP_VP8_HEIGHT_OFFSET = 28;
const WEBP_VP8_SIDE_MASK = 0x3fff;
const WEBP_VP8L_MIN_BYTES = 25;
const WEBP_VP8L_SIGNATURE = 0x2f;
const WEBP_VP8L_BITS_OFFSET = 21;
const WEBP_VP8L_SIDE_BITS = 14;
const WEBP_VP8X_MIN_CHUNK = 10;
const WEBP_VP8X_MIN_BYTES = 30;
const WEBP_VP8X_ANIMATION_FLAG = 0x02;
const WEBP_VP8X_WIDTH_OFFSET = 24;
const WEBP_VP8X_HEIGHT_OFFSET = 27;

const u16be = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);

const u32be = (bytes: Uint8Array, offset: number): number =>
  u16be(bytes, offset) * 0x10000 + u16be(bytes, offset + 2);

const u16le = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);

const u24le = (bytes: Uint8Array, offset: number): number =>
  u16le(bytes, offset) | ((bytes[offset + 2] ?? 0) << 16);

const u32le = (bytes: Uint8Array, offset: number): number =>
  u16le(bytes, offset) + u16le(bytes, offset + 2) * 0x10000;

export const readPngSize = (bytes: Uint8Array): Size | null => {
  if (bytes.length < PNG_IHDR_MIN_BYTES) return null;
  if (u32be(bytes, PNG_IHDR_LENGTH_OFFSET) !== PNG_IHDR_LENGTH) return null;
  if (!startsWith(bytes, "IHDR", PNG_IHDR_TYPE_OFFSET)) return null;
  const width = u32be(bytes, PNG_IHDR_WIDTH_OFFSET);
  const height = u32be(bytes, PNG_IHDR_HEIGHT_OFFSET);
  return width === 0 || height === 0 ? null : { width, height };
};

const readExifOrientation = (bytes: Uint8Array, start: number, end: number): number | null => {
  if (!startsWith(bytes, EXIF_TAG, start)) return null;
  if (end - start < EXIF_PREFIX_BYTES + TIFF_HEADER_BYTES) return null;
  const tiff = start + EXIF_PREFIX_BYTES;
  const little = startsWith(bytes, TIFF_LITTLE, tiff);
  if (!little && !startsWith(bytes, TIFF_BIG, tiff)) return null;
  const u16 = (offset: number): number => (little ? u16le(bytes, offset) : u16be(bytes, offset));
  const u32 = (offset: number): number => (little ? u32le(bytes, offset) : u32be(bytes, offset));
  if (u16(tiff + 2) !== TIFF_MAGIC) return null;
  const directory = tiff + u32(tiff + 4);
  if (directory + 2 > end) return null;
  const count = u16(directory);
  for (let index = 0; index < count; index += 1) {
    const entry = directory + 2 + index * TIFF_ENTRY_BYTES;
    if (entry + TIFF_ENTRY_BYTES > end) return null;
    if (u16(entry) === TIFF_ORIENTATION_TAG && u16(entry + 2) === TIFF_TYPE_SHORT) {
      const value = u16(entry + TIFF_VALUE_OFFSET);
      return value >= 1 && value <= MAX_ORIENTATION ? value : DEFAULT_ORIENTATION;
    }
  }
  return null;
};

const isStartOfFrame = (marker: number): boolean =>
  marker >= JPEG_MARKER_SOF_FIRST &&
  marker <= JPEG_MARKER_SOF_LAST &&
  !JPEG_NOT_SOF.includes(marker);

const isStandalone = (marker: number): boolean =>
  marker === JPEG_MARKER_SOI ||
  marker === JPEG_MARKER_TEM ||
  (marker >= JPEG_MARKER_RST_FIRST && marker <= JPEG_MARKER_RST_LAST);

const readFrameSize = (
  bytes: Uint8Array,
  position: number,
  length: number,
  orientation: number,
): (Size & { orientation: number }) | null => {
  if (length < JPEG_SOF_MIN_LENGTH) return null;
  const height = u16be(bytes, position + JPEG_SOF_HEIGHT_OFFSET);
  const width = u16be(bytes, position + JPEG_SOF_WIDTH_OFFSET);
  return width === 0 || height === 0 ? null : { width, height, orientation };
};

export const readJpegHeader = (bytes: Uint8Array): (Size & { orientation: number }) | null => {
  const limit = Math.min(bytes.length, DESIGN_IMPORT_LIMITS.jpegHeaderWindowBytes);
  let orientation: number | null = null;
  let position = JPEG_FIRST_MARKER_OFFSET;
  while (position + JPEG_SEGMENT_HEADER_BYTES <= limit) {
    if (bytes[position] !== JPEG_MARKER_PREFIX) return null;
    while (bytes[position + 1] === JPEG_MARKER_PREFIX && position + 1 < limit) position += 1;
    const marker = bytes[position + 1] ?? JPEG_MARKER_STUFFED;
    if (marker === JPEG_MARKER_STUFFED) return null;
    if (isStandalone(marker)) {
      position += JPEG_LENGTH_FIELD_BYTES;
      continue;
    }
    if (marker === JPEG_MARKER_EOI || marker === JPEG_MARKER_SOS) return null;
    const length = u16be(bytes, position + 2);
    const end = position + JPEG_LENGTH_FIELD_BYTES + length;
    if (length < JPEG_LENGTH_FIELD_BYTES || end > limit) return null;
    if (marker === JPEG_MARKER_APP1 && orientation === null) {
      orientation = readExifOrientation(bytes, position + JPEG_SEGMENT_HEADER_BYTES, end);
    }
    if (!isStartOfFrame(marker)) {
      position = end;
      continue;
    }
    return readFrameSize(bytes, position, length, orientation ?? DEFAULT_ORIENTATION);
  }
  return null;
};

const readVp8x = (bytes: Uint8Array): WebpSize | null => {
  if (bytes.length < WEBP_VP8X_MIN_BYTES) return null;
  if (u32le(bytes, WEBP_CHUNK_SIZE_OFFSET) < WEBP_VP8X_MIN_CHUNK) return null;
  return {
    width: u24le(bytes, WEBP_VP8X_WIDTH_OFFSET) + 1,
    height: u24le(bytes, WEBP_VP8X_HEIGHT_OFFSET) + 1,
    animated: ((bytes[WEBP_CHUNK_DATA_OFFSET] ?? 0) & WEBP_VP8X_ANIMATION_FLAG) !== 0,
  };
};

const readVp8 = (bytes: Uint8Array): WebpSize | null => {
  if (bytes.length < WEBP_VP8_MIN_BYTES) return null;
  const startCode = WEBP_VP8_START_CODE.every(
    (value, index) => bytes[WEBP_VP8_START_CODE_OFFSET + index] === value,
  );
  if (!startCode) return null;
  const width = u16le(bytes, WEBP_VP8_WIDTH_OFFSET) & WEBP_VP8_SIDE_MASK;
  const height = u16le(bytes, WEBP_VP8_HEIGHT_OFFSET) & WEBP_VP8_SIDE_MASK;
  return width === 0 || height === 0 ? null : { width, height, animated: false };
};

const readVp8l = (bytes: Uint8Array): WebpSize | null => {
  if (bytes.length < WEBP_VP8L_MIN_BYTES) return null;
  if (bytes[WEBP_CHUNK_DATA_OFFSET] !== WEBP_VP8L_SIGNATURE) return null;
  const bits = u32le(bytes, WEBP_VP8L_BITS_OFFSET);
  const sideRange = 2 ** WEBP_VP8L_SIDE_BITS;
  return {
    width: (bits % sideRange) + 1,
    height: (Math.floor(bits / sideRange) % sideRange) + 1,
    animated: false,
  };
};

export const readWebpSize = (bytes: Uint8Array): WebpSize | null => {
  if (startsWith(bytes, "VP8X", WEBP_CHUNK_TYPE_OFFSET)) return readVp8x(bytes);
  if (startsWith(bytes, "VP8L", WEBP_CHUNK_TYPE_OFFSET)) return readVp8l(bytes);
  if (startsWith(bytes, "VP8 ", WEBP_CHUNK_TYPE_OFFSET)) return readVp8(bytes);
  return null;
};

const unoriented = (size: Size, animated = false): ImageHeader => ({
  ...size,
  orientation: DEFAULT_ORIENTATION,
  animated,
  orientationKnown: false,
});

const readByFormat = (bytes: Uint8Array, format: DesignImportFormat): ImageHeader | null => {
  if (format === DesignImportFormat.Png) {
    const size = readPngSize(bytes);
    return size === null ? null : unoriented(size);
  }
  if (format === DesignImportFormat.Jpeg) {
    const header = readJpegHeader(bytes);
    return header === null ? null : { ...header, animated: false, orientationKnown: true };
  }
  if (format === DesignImportFormat.Webp) {
    const size = readWebpSize(bytes);
    return size === null ? null : unoriented(size, size.animated);
  }
  return null;
};

export const readImageHeader = (
  bytes: Uint8Array,
  format: DesignImportFormat,
): Result<{ header: ImageHeader }> => {
  const header = readByFormat(bytes, format);
  return header === null ? invalid(DESIGN_IMPORT_MESSAGE.imageCorrupt) : { ok: true, header };
};

export const orientedSize = (header: ImageHeader): Size =>
  header.orientation >= FIRST_SWAPPED_ORIENTATION
    ? { width: header.height, height: header.width }
    : { width: header.width, height: header.height };
