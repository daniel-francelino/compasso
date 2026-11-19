const le16 = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff];
const be32 = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];
const ascii = (text: string): number[] => Array.from(text, (character) => character.charCodeAt(0));

export const gifBytes = (
  width: number,
  height: number,
  options: {
    frames?: number;
    extensionBlocks?: number;
    trailer?: boolean;
    frameSize?: readonly [number, number];
    laterFrameSize?: readonly [number, number];
  } = {},
): Uint8Array<ArrayBuffer> => {
  const {
    frames = 1,
    extensionBlocks = 0,
    trailer = true,
    frameSize = [1, 1],
    laterFrameSize = frameSize,
  } = options;
  const out: number[] = [...ascii("GIF89a"), ...le16(width), ...le16(height), 0, 0, 0];
  for (let index = 0; index < extensionBlocks; index += 1) out.push(0x21, 0xfe, 0);
  for (let index = 0; index < frames; index += 1) {
    out.push(
      0x2c,
      0,
      0,
      0,
      0,
      ...le16((index === 0 ? frameSize : laterFrameSize)[0]),
      ...le16((index === 0 ? frameSize : laterFrameSize)[1]),
      0,
      2,
      2,
      0x44,
      0x01,
      0,
    );
  }
  if (trailer) out.push(0x3b);
  return Uint8Array.from(out);
};

const box = (type: string, payload: number[]): number[] => [
  ...be32(payload.length + 8),
  ...ascii(type),
  ...payload,
];

export const avifBytes = (
  sizes: ReadonlyArray<readonly [number, number]>,
  options: {
    brand?: string;
    truncateMeta?: boolean;
    zeroBoxSize?: boolean;
    padding?: number;
  } = {},
): Uint8Array<ArrayBuffer> => {
  const { brand = "avif", truncateMeta = false, zeroBoxSize = false, padding = 0 } = options;
  const ispe = sizes.flatMap(([w, h]) => box("ispe", [0, 0, 0, 0, ...be32(w), ...be32(h)]));
  const filler = padding > 0 ? box("free", new Array<number>(padding).fill(0)) : [];
  const meta = box("meta", [0, 0, 0, 0, ...box("iprp", box("ipco", [...ispe, ...filler]))]);
  const ftyp = box("ftyp", [...ascii(brand), 0, 0, 0, 0, ...ascii("mif1")]);
  const body = truncateMeta ? meta.slice(0, meta.length - 6) : meta;
  if (zeroBoxSize) body.splice(0, 4, 0, 0, 0, 0);
  return Uint8Array.from([...ftyp, ...body]);
};

export type TiffOptions = {
  bits?: number;
  samples?: number;
  compression?: number;
  photometric?: number;
  planar?: number;
  stripBytes?: number;
  stripData?: Uint8Array;
  stripCount?: number;
  claimedStripBytes?: number;
  extraIfds?: number;
  loop?: boolean;
  tiled?: boolean;
  bigTiff?: boolean;
  bigEndian?: boolean;
};

const word = (value: number, big: boolean): number[] =>
  big ? [(value >> 8) & 0xff, value & 0xff] : le16(value);
const dword = (value: number, big: boolean): number[] =>
  big ? be32(value) : [...le16(value & 0xffff), ...le16(value >>> 16)];

export const tiffBytes = (
  width: number,
  height: number,
  options: TiffOptions = {},
): Uint8Array<ArrayBuffer> => {
  const {
    bits = 8,
    samples = 3,
    compression = 1,
    photometric = 2,
    planar = 1,
    stripData,
    stripBytes = stripData?.length ?? 16,
    claimedStripBytes = stripBytes,
    extraIfds = 0,
    loop = false,
    tiled = false,
    bigTiff = false,
    bigEndian = false,
  } = options;
  const big = bigEndian;
  const entry = (tag: number, type: number, count: number, value: number): number[] => [
    ...word(tag, big),
    ...word(type, big),
    ...dword(count, big),
    ...(type === 3 && count === 1 ? [...word(value, big), 0, 0] : dword(value, big)),
  ];
  const entryCount = tiled ? 11 : 10;
  const ifdSize = 2 + entryCount * 12 + 4;
  const external = bits !== 0 && samples > 2 ? samples * 2 : 0;
  const externalAt = 8 + ifdSize;
  const extraAt = externalAt + external;
  const dataAt = extraAt + extraIfds * 6;
  const entries = [
    entry(256, 4, 1, width),
    entry(257, 4, 1, height),
    samples > 2 ? entry(258, 3, samples, externalAt) : entry(258, 3, 1, bits),
    entry(259, 3, 1, compression),
    entry(262, 3, 1, photometric),
    entry(273, 4, 1, dataAt),
    entry(277, 3, 1, samples),
    entry(279, 4, 1, claimedStripBytes),
    entry(284, 3, 1, planar),
    entry(278, 4, 1, height),
    ...(tiled ? [entry(322, 4, 1, 16)] : []),
  ];
  const nextAfterZero = extraIfds > 0 ? extraAt : loop ? 8 : 0;
  const ifd0 = [...word(entryCount, big), ...entries.flat(), ...dword(nextAfterZero, big)];
  const sampleBits =
    external > 0 ? Array.from({ length: samples }, () => word(bits, big)).flat() : [];
  const extra = Array.from({ length: extraIfds }, (_, index) => [
    ...word(0, big),
    ...dword(index + 1 < extraIfds ? extraAt + (index + 1) * 6 : 0, big),
  ]).flat();
  const header = bigEndian
    ? [0x4d, 0x4d, 0, bigTiff ? 43 : 42, ...be32(8)]
    : [0x49, 0x49, bigTiff ? 43 : 42, 0, 8, 0, 0, 0];
  return Uint8Array.from([
    ...header,
    ...ifd0,
    ...sampleBits,
    ...extra,
    ...(stripData ?? new Array<number>(stripBytes).fill(0)),
  ]);
};

export type RawEntry = { tag: number; type: number; count: number; value: number };

export const rawTiff = (
  entries: readonly RawEntry[],
  tail: Uint8Array = new Uint8Array(),
): Uint8Array<ArrayBuffer> => {
  const ifd = [
    ...le16(entries.length),
    ...entries.flatMap((item) => [
      ...le16(item.tag),
      ...le16(item.type),
      ...dword(item.count, false),
      ...dword(item.value, false),
    ]),
    0,
    0,
    0,
    0,
  ];
  return Uint8Array.from([0x49, 0x49, 42, 0, 8, 0, 0, 0, ...ifd, ...tail]);
};
