import type { TiffInfo } from "@/lib/shared/design/import/worker/tiff-header";

const SHORT = 3;
const LONG = 4;
const ENTRY_BYTES = 12;
const HEADER_BYTES = 8;
const UNCOMPRESSED = 1;

type Field = { tag: number; type: number; values: readonly number[] };

export const rebuildTiff = (
  info: TiffInfo,
  strips: readonly Uint8Array[],
  inflated: boolean,
): ArrayBuffer => {
  const little = info.littleEndian;
  const put16 = (view: DataView, at: number, value: number): void =>
    view.setUint16(at, value, little);
  const put32 = (view: DataView, at: number, value: number): void =>
    view.setUint32(at, value, little);
  const plain = inflated || info.compression === UNCOMPRESSED;
  const fields: Field[] = [
    { tag: 256, type: LONG, values: [info.width] },
    { tag: 257, type: LONG, values: [info.height] },
    {
      tag: 258,
      type: SHORT,
      values: Array.from({ length: info.samplesPerPixel }, () => info.bitsPerSample),
    },
    { tag: 259, type: SHORT, values: [plain ? UNCOMPRESSED : info.compression] },
    { tag: 262, type: SHORT, values: [info.photometric] },
    { tag: 273, type: LONG, values: strips.map(() => 0) },
    { tag: 277, type: SHORT, values: [info.samplesPerPixel] },
    { tag: 278, type: LONG, values: [info.rowsPerStrip] },
    { tag: 279, type: LONG, values: strips.map((strip) => strip.length) },
    { tag: 284, type: SHORT, values: [1] },
    { tag: 317, type: SHORT, values: [info.predictor] },
    ...(info.colorMap === null ? [] : [{ tag: 320, type: SHORT, values: info.colorMap }]),
    ...(info.extraSamples === null ? [] : [{ tag: 338, type: SHORT, values: info.extraSamples }]),
  ];
  const sizeOf = (field: Field): number => field.values.length * (field.type === SHORT ? 2 : 4);
  const ifdBytes = 2 + fields.length * ENTRY_BYTES + 4;
  const external = fields.reduce((sum, field) => sum + (sizeOf(field) > 4 ? sizeOf(field) : 0), 0);
  const dataStart = HEADER_BYTES + ifdBytes + external;
  const total = dataStart + strips.reduce((sum, strip) => sum + strip.length, 0);
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);
  out.set(little ? [0x49, 0x49, 42, 0] : [0x4d, 0x4d, 0, 42], 0);
  put32(view, 4, HEADER_BYTES);
  put16(view, HEADER_BYTES, fields.length);
  let spill = HEADER_BYTES + ifdBytes;
  let stripAt = dataStart;
  const stripStarts = strips.map((strip) => {
    const start = stripAt;
    stripAt += strip.length;
    return start;
  });
  fields.forEach((field, index) => {
    const base = HEADER_BYTES + 2 + index * ENTRY_BYTES;
    const values = field.tag === 273 ? stripStarts : field.values;
    put16(view, base, field.tag);
    put16(view, base + 2, field.type);
    put32(view, base + 4, values.length);
    const size = values.length * (field.type === SHORT ? 2 : 4);
    const at = size > 4 ? spill : base + 8;
    if (size > 4) {
      put32(view, base + 8, spill);
      spill += size;
    }
    values.forEach((value, position) => {
      if (field.type === SHORT) put16(view, at + position * 2, value);
      else put32(view, at + position * 4, value);
    });
  });
  strips.forEach((strip, index) => out.set(strip, stripStarts[index] ?? 0));
  return buffer;
};
