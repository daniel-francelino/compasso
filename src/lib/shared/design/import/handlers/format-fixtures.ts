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
  options: { frames?: number; extensionBlocks?: number; trailer?: boolean } = {},
): Uint8Array<ArrayBuffer> => {
  const { frames = 1, extensionBlocks = 0, trailer = true } = options;
  const out: number[] = [...ascii("GIF89a"), ...le16(width), ...le16(height), 0, 0, 0];
  for (let index = 0; index < extensionBlocks; index += 1) out.push(0x21, 0xfe, 0);
  for (let index = 0; index < frames; index += 1) {
    out.push(0x2c, 0, 0, 0, 0, ...le16(1), ...le16(1), 0, 2, 2, 0x44, 0x01, 0);
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
  options: { brand?: string; truncateMeta?: boolean; zeroBoxSize?: boolean } = {},
): Uint8Array<ArrayBuffer> => {
  const { brand = "avif", truncateMeta = false, zeroBoxSize = false } = options;
  const ispe = sizes.flatMap(([w, h]) => box("ispe", [0, 0, 0, 0, ...be32(w), ...be32(h)]));
  const meta = box("meta", [0, 0, 0, 0, ...box("iprp", box("ipco", ispe))]);
  const ftyp = box("ftyp", [...ascii(brand), 0, 0, 0, 0, ...ascii("mif1")]);
  const body = truncateMeta ? meta.slice(0, meta.length - 6) : meta;
  if (zeroBoxSize) body.splice(0, 4, 0, 0, 0, 0);
  return Uint8Array.from([...ftyp, ...body]);
};
