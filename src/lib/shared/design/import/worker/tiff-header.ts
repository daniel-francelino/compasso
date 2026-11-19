export const TIFF_LIMITS = {
  maxIfds: 64,
  maxEntries: 4096,
  maxStrips: 65_536,
  maxDeclaredSide: 32_768,
  maxSamples: 5,
} as const;

export const TiffRefusal = {
  Corrupt: "corrupt",
  Unsupported: "unsupported",
  TooLarge: "too_large",
} as const;
export type TiffRefusal = (typeof TiffRefusal)[keyof typeof TiffRefusal];

export type TiffStrip = { offset: number; count: number };

export type TiffInfo = {
  width: number;
  height: number;
  bitsPerSample: number;
  samplesPerPixel: number;
  photometric: number;
  compression: number;
  predictor: number;
  rowsPerStrip: number;
  strips: TiffStrip[];
  colorMap: number[] | null;
  extraSamples: number[] | null;
  ifdCount: number;
  littleEndian: boolean;
};

export type TiffHeaderResult = { ok: true; info: TiffInfo } | { ok: false; refusal: TiffRefusal };

const TAG = {
  width: 256,
  height: 257,
  bits: 258,
  compression: 259,
  photometric: 262,
  fillOrder: 266,
  stripOffsets: 273,
  samples: 277,
  rowsPerStrip: 278,
  stripByteCounts: 279,
  planar: 284,
  predictor: 317,
  colorMap: 320,
  tileWidth: 322,
  tileLength: 323,
  tileOffsets: 324,
  tileByteCounts: 325,
  extraSamples: 338,
  sampleFormat: 339,
} as const;

const TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
  13: 4,
};
const SHORT = 3;
const LONG = 4;
const ENTRY_BYTES = 12;
const ALLOWED_COMPRESSION = [1, 5, 8, 32946, 32773];
const ALLOWED_PHOTOMETRIC = [0, 1, 2, 3, 5];
const ALLOWED_BITS = [8, 16];
const TILE_TAGS: number[] = [TAG.tileWidth, TAG.tileLength, TAG.tileOffsets, TAG.tileByteCounts];
const PALETTE_ENTRIES = 256;
const UNCOMPRESSED = 1;
const STRIP_SLACK_BYTES = 1024;
const STRIP_EXPANSION = 2;
const RAW_COMPRESSED = [5, 32773];
const MIN_SAMPLES: Record<number, number> = { 0: 1, 1: 1, 2: 3, 3: 1, 5: 4 };

type Entry = { tag: number; type: number; count: number; valueOffset: number };

const refuse = (refusal: TiffRefusal): TiffHeaderResult => ({ ok: false, refusal });

const readEntries = (view: DataView, ifdOffset: number, little: boolean): Entry[] | null => {
  if (ifdOffset < 8 || ifdOffset + 2 > view.byteLength) return null;
  const count = view.getUint16(ifdOffset, little);
  if (count > TIFF_LIMITS.maxEntries || ifdOffset + 2 + count * ENTRY_BYTES + 4 > view.byteLength) {
    return null;
  }
  const entries = Array.from({ length: count }, (_, index): Entry => {
    const base = ifdOffset + 2 + index * ENTRY_BYTES;
    return {
      tag: view.getUint16(base, little),
      type: view.getUint16(base + 2, little),
      count: view.getUint32(base + 4, little),
      valueOffset: base + 8,
    };
  });
  const unique = new Set(entries.map((entry) => entry.tag));
  return unique.size === entries.length ? entries : null;
};

const entryFits = (view: DataView, entry: Entry, little: boolean): boolean => {
  const size = TYPE_SIZE[entry.type];
  if (size === undefined) return false;
  const bytes = size * entry.count;
  if (bytes <= 4) return true;
  const start = view.getUint32(entry.valueOffset, little);
  return start >= 8 && start + bytes <= view.byteLength;
};

const readValues = (
  view: DataView,
  entry: Entry,
  little: boolean,
  allowed: readonly number[],
  maxCount: number,
): number[] | null => {
  if (!allowed.includes(entry.type) || entry.count === 0 || entry.count > maxCount) return null;
  if (!entryFits(view, entry, little)) return null;
  const size = TYPE_SIZE[entry.type] ?? 0;
  const start =
    size * entry.count <= 4 ? entry.valueOffset : view.getUint32(entry.valueOffset, little);
  return Array.from({ length: entry.count }, (_, index) => {
    const at = start + index * size;
    return size === 2 ? view.getUint16(at, little) : view.getUint32(at, little);
  });
};

const walkChain = (view: DataView, little: boolean): { first: Entry[]; count: number } | null => {
  const seen = new Set<number>();
  let offset = view.getUint32(4, little);
  let first: Entry[] | null = null;
  while (offset !== 0) {
    if (seen.has(offset) || seen.size >= TIFF_LIMITS.maxIfds) return null;
    seen.add(offset);
    const entries = readEntries(view, offset, little);
    if (entries === null || !entries.every((entry) => entryFits(view, entry, little))) return null;
    first ??= entries;
    offset = view.getUint32(offset + 2 + entries.length * ENTRY_BYTES, little);
  }
  return first === null ? null : { first, count: seen.size };
};

type Reader = (
  tag: number,
  allowed: readonly number[],
  maxCount: number,
) => number[] | null | undefined;

const readerOf = (view: DataView, entries: Entry[], little: boolean): Reader => {
  const byTag = new Map(entries.map((entry) => [entry.tag, entry]));
  return (tag, allowed, maxCount) => {
    const entry = byTag.get(tag);
    if (entry === undefined) return undefined;
    return readValues(view, entry, little, allowed, maxCount);
  };
};

const bytesPerRow = (width: number, samples: number, bits: number): number =>
  Math.ceil((width * samples * bits) / 8);

export const expectedStripBytes = (info: TiffInfo, index: number): number => {
  const rows = Math.min(info.rowsPerStrip, info.height - index * info.rowsPerStrip);
  return Math.max(0, rows) * bytesPerRow(info.width, info.samplesPerPixel, info.bitsPerSample);
};

const rebuiltCompressedBytes = (info: TiffInfo): number =>
  RAW_COMPRESSED.includes(info.compression)
    ? info.strips.reduce((sum, strip) => sum + strip.count, 0)
    : 0;

export const workingSetBytes = (info: TiffInfo, fileBytes: number): number =>
  info.width * info.height * ((info.samplesPerPixel * info.bitsPerSample) / 8 + 8) +
  2 * fileBytes +
  rebuiltCompressedBytes(info);

type StripLayout = {
  offsets: readonly number[];
  counts: readonly number[];
  fileBytes: number;
  compression: number;
  expected: (index: number) => number;
};

const stripLayoutOk = (layout: StripLayout): boolean => {
  const { offsets, counts, fileBytes, compression, expected } = layout;
  let previousEnd = 8;
  let total = 0;
  for (const [index, start] of offsets.entries()) {
    const count = counts[index] ?? 0;
    if (start < previousEnd) return false;
    previousEnd = start + count;
    total += count;
    if (previousEnd > fileBytes || total > fileBytes) return false;
    if (
      compression !== UNCOMPRESSED &&
      count > expected(index) * STRIP_EXPANSION + STRIP_SLACK_BYTES
    ) {
      return false;
    }
  }
  return true;
};

const scalarOf = (read: Reader, tag: number, fallback: number): number | null => {
  const values = read(tag, [SHORT, LONG], 1);
  if (values === undefined) return fallback;
  return values === null || values.length !== 1 ? null : (values[0] ?? null);
};

export const readTiffInfo = (bytes: Uint8Array): TiffHeaderResult => {
  if (bytes.length < 8) return refuse(TiffRefusal.Corrupt);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = bytes[0] === 0x49 && bytes[1] === 0x49;
  const big = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (!little && !big) return refuse(TiffRefusal.Corrupt);
  const magic = view.getUint16(2, little);
  if (magic === 43) return refuse(TiffRefusal.Unsupported);
  if (magic !== 42) return refuse(TiffRefusal.Corrupt);
  const chain = walkChain(view, little);
  if (chain === null) return refuse(TiffRefusal.Corrupt);
  const { first } = chain;
  const read = readerOf(view, first, little);
  const width = scalarOf(read, TAG.width, 0);
  const height = scalarOf(read, TAG.height, 0);
  if (width === null || height === null || width < 1 || height < 1) {
    return refuse(TiffRefusal.Corrupt);
  }
  if (width > TIFF_LIMITS.maxDeclaredSide || height > TIFF_LIMITS.maxDeclaredSide) {
    return refuse(TiffRefusal.TooLarge);
  }
  const compression = scalarOf(read, TAG.compression, 1);
  const photometric = scalarOf(read, TAG.photometric, -1);
  const samples = scalarOf(read, TAG.samples, 1);
  const planar = scalarOf(read, TAG.planar, 1);
  const predictor = scalarOf(read, TAG.predictor, 1);
  const fill = scalarOf(read, TAG.fillOrder, 1);
  const rows = scalarOf(read, TAG.rowsPerStrip, height);
  if ([compression, photometric, samples, planar, predictor, fill, rows].includes(null)) {
    return refuse(TiffRefusal.Corrupt);
  }
  const bitValues = read(TAG.bits, [SHORT], TIFF_LIMITS.maxSamples);
  const bits = bitValues === undefined ? 1 : bitValues?.[0];
  const sampleCount = samples ?? 1;
  const bitsConsistent =
    bitValues === undefined ||
    (bitValues !== null &&
      bitValues.length === sampleCount &&
      bitValues.every((value) => value === bits));
  if (!bitsConsistent) return refuse(TiffRefusal.Corrupt);
  const formats = read(TAG.sampleFormat, [SHORT], TIFF_LIMITS.maxSamples);
  const tiled = first.some((entry) => TILE_TAGS.includes(entry.tag));
  const photo = photometric ?? -1;
  const supported =
    bits !== undefined &&
    ALLOWED_BITS.includes(bits) &&
    ALLOWED_COMPRESSION.includes(compression ?? -1) &&
    ALLOWED_PHOTOMETRIC.includes(photo) &&
    sampleCount >= (MIN_SAMPLES[photo] ?? 1) &&
    sampleCount <= TIFF_LIMITS.maxSamples &&
    planar === 1 &&
    fill === 1 &&
    [1, 2].includes(predictor ?? 0) &&
    (photo !== 3 || bits === 8) &&
    !tiled &&
    (formats === undefined || (formats !== null && formats.every((value) => value === 1)));
  if (!supported) return refuse(TiffRefusal.Unsupported);
  const rowsPerStrip = Math.min(rows ?? height, height);
  if (rowsPerStrip < 1) return refuse(TiffRefusal.Corrupt);
  const stripCount = Math.ceil(height / rowsPerStrip);
  const offsets = read(TAG.stripOffsets, [SHORT, LONG], TIFF_LIMITS.maxStrips);
  const counts = read(TAG.stripByteCounts, [SHORT, LONG], TIFF_LIMITS.maxStrips);
  const stripsOk =
    offsets !== undefined &&
    offsets !== null &&
    counts !== undefined &&
    counts !== null &&
    offsets.length === stripCount &&
    counts.length === stripCount &&
    stripLayoutOk({
      offsets,
      counts,
      fileBytes: bytes.length,
      compression: compression ?? UNCOMPRESSED,
      expected: (index) =>
        Math.max(0, Math.min(rowsPerStrip, height - index * rowsPerStrip)) *
        bytesPerRow(width, sampleCount, bits ?? 8),
    });
  if (!stripsOk) return refuse(TiffRefusal.Corrupt);
  const colorMap = read(TAG.colorMap, [SHORT], 3 * PALETTE_ENTRIES);
  const paletteOk =
    photo !== 3 || (colorMap !== undefined && colorMap?.length === 3 * PALETTE_ENTRIES);
  const extra = read(TAG.extraSamples, [SHORT], TIFF_LIMITS.maxSamples);
  const extraOk = extra === undefined || (extra !== null && extra.every((value) => value <= 2));
  if (colorMap === null || extra === null || !paletteOk || !extraOk) {
    return refuse(TiffRefusal.Corrupt);
  }
  return {
    ok: true,
    info: {
      width,
      height,
      bitsPerSample: bits ?? 8,
      samplesPerPixel: sampleCount,
      photometric: photo,
      compression: compression ?? 1,
      predictor: predictor ?? 1,
      rowsPerStrip,
      strips: offsets.map((offset, index) => ({ offset, count: counts[index] ?? 0 })),
      colorMap: photo === 3 ? (colorMap ?? null) : null,
      extraSamples: extra ?? null,
      ifdCount: chain.count,
      littleEndian: little,
    },
  };
};
