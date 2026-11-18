const ascii = (text: string): number[] => Array.from(text, (character) => character.charCodeAt(0));

const be16 = (value: number): number[] => [(value >> 8) & 0xff, value & 0xff];
const be32 = (value: number): number[] => [
  ...be16(Math.floor(value / 0x10000)),
  ...be16(value % 0x10000),
];
const le16 = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff];
const le24 = (value: number): number[] => [...le16(value & 0xffff), (value >> 16) & 0xff];
const le32 = (value: number): number[] => [
  ...le16(value % 0x10000),
  ...le16(Math.floor(value / 0x10000)),
];

const APP_SEGMENT_PAYLOAD = 60_000;

const zeros = (count: number): number[] => new Array<number>(count).fill(0);

export const PNG_SIGNATURE_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export const pngBytes = (
  width: number,
  height: number,
  options: { padding?: number; ihdrLength?: number; chunk?: string } = {},
): Uint8Array<ArrayBuffer> =>
  Uint8Array.from([
    ...PNG_SIGNATURE_BYTES,
    ...be32(options.ihdrLength ?? 13),
    ...ascii(options.chunk ?? "IHDR"),
    ...be32(width),
    ...be32(height),
    8,
    6,
    0,
    0,
    0,
    ...zeros(options.padding ?? 1024),
  ]);

const exifSegment = (orientation: number, big: boolean): number[] => {
  const u16 = big ? be16 : le16;
  const u32 = big ? be32 : le32;
  const tiff = [
    ...ascii(big ? "MM" : "II"),
    ...u16(42),
    ...u32(8),
    ...u16(1),
    ...u16(0x0112),
    ...u16(3),
    ...u32(1),
    ...u16(orientation),
    0,
    0,
    ...u32(0),
  ];
  const payload = [...ascii("Exif"), 0, 0, ...tiff];
  return [0xff, 0xe1, ...be16(payload.length + 2), ...payload];
};

export const jpegBytes = (
  width: number,
  height: number,
  options: {
    orientation?: number;
    bigEndian?: boolean;
    padding?: number;
    sof?: number;
    prefix?: number[];
  } = {},
): Uint8Array<ArrayBuffer> => {
  const padding = options.padding ?? 0;
  const filler = Array.from({ length: Math.ceil(padding / APP_SEGMENT_PAYLOAD) }).flatMap(
    (_unused, index) => {
      const size = Math.min(APP_SEGMENT_PAYLOAD, padding - index * APP_SEGMENT_PAYLOAD);
      return [0xff, 0xe2, ...be16(size + 2), ...zeros(size)];
    },
  );
  const exif =
    options.orientation === undefined
      ? []
      : exifSegment(options.orientation, options.bigEndian ?? false);
  return Uint8Array.from([
    0xff,
    0xd8,
    ...exif,
    ...filler,
    ...(options.prefix ?? []),
    0xff,
    options.sof ?? 0xc0,
    ...be16(11),
    8,
    ...be16(height),
    ...be16(width),
    1,
    1,
    0x11,
    0,
    0xff,
    0xda,
    0,
    0,
  ]);
};

export type WebpKind = "vp8" | "vp8l" | "vp8x";

const FOURCC: Record<WebpKind, string> = { vp8: "VP8 ", vp8l: "VP8L", vp8x: "VP8X" };

const webpBody = (kind: WebpKind, width: number, height: number, animated: boolean): number[] => {
  if (kind === "vp8") return [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(width), ...le16(height)];
  if (kind === "vp8l") return [0x2f, ...le32(width - 1 + (height - 1) * 2 ** 14)];
  return [animated ? 0x02 : 0, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)];
};

export const webpBytes = (
  kind: WebpKind,
  width: number,
  height: number,
  options: { animated?: boolean; chunkSize?: number } = {},
): Uint8Array<ArrayBuffer> => {
  const padded = [...webpBody(kind, width, height, options.animated === true), ...zeros(16)];
  return Uint8Array.from([
    ...ascii("RIFF"),
    ...le32(padded.length + 12),
    ...ascii("WEBP"),
    ...ascii(FOURCC[kind]),
    ...le32(options.chunkSize ?? (kind === "vp8x" ? 10 : padded.length)),
    ...padded,
  ]);
};
