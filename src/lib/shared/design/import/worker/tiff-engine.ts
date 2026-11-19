import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { inflateBounded } from "@/lib/shared/design/import/worker/tiff-inflate";
import {
  type TiffInfo,
  TiffRefusal,
  expectedStripBytes,
  readTiffInfo,
  workingSetBytes,
} from "@/lib/shared/design/import/worker/tiff-header";
import { rebuildTiff } from "@/lib/shared/design/import/worker/tiff-rebuild";
import type { TiffResponse } from "@/lib/shared/design/import/worker/tiff-protocol";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const PHOTOMETRIC_CMYK = 5;
const PHOTOMETRIC_BLACK_IS_ZERO = 1;
const PHOTOMETRIC_WHITE_IS_ZERO = 0;

type Ifd = { width: number; height: number };

export type UtifLike = {
  decode: (buffer: ArrayBuffer, options?: { parseMN?: boolean }) => Ifd[];
  decodeImage: (buffer: ArrayBuffer, ifd: Ifd, ifds: Ifd[]) => void;
  toRGBA8: (ifd: Ifd) => Uint8Array;
};

export const isUtifLike = (value: unknown): value is UtifLike =>
  typeof value === "object" &&
  value !== null &&
  "decode" in value &&
  "decodeImage" in value &&
  "toRGBA8" in value &&
  typeof value.decode === "function" &&
  typeof value.decodeImage === "function" &&
  typeof value.toRGBA8 === "function";

type Size = { width: number; height: number };

const targetSize = (source: Size): Size => {
  const longest = Math.max(source.width, source.height);
  const max = DESIGN_IMPORT_LIMITS.maxPageSide;
  if (longest <= max) return source;
  const scale = max / longest;
  return {
    width: Math.max(1, Math.min(max, Math.round(source.width * scale))),
    height: Math.max(1, Math.min(max, Math.round(source.height * scale))),
  };
};

const resample = (source: Uint8Array, from: Size, to: Size): Uint8Array => {
  const out = new Uint8Array(to.width * to.height * 4);
  for (let y = 0; y < to.height; y += 1) {
    const sy = Math.min(from.height - 1, Math.floor(((y + 0.5) * from.height) / to.height));
    for (let x = 0; x < to.width; x += 1) {
      const sx = Math.min(from.width - 1, Math.floor(((x + 0.5) * from.width) / to.width));
      const at = (sy * from.width + sx) * 4;
      out.set(source.subarray(at, at + 4), (y * to.width + x) * 4);
    }
  }
  return out;
};

export type TiffEngineOutput = { response: TiffResponse; transfer: ArrayBuffer[] };

const refusal = (id: number, why: TiffRefusal): TiffEngineOutput => ({
  response: { id, status: "error", refusal: why },
  transfer: [],
});

const DEFLATE = [8, 32946];

const padded = (data: Uint8Array, length: number): Uint8Array => {
  const out = new Uint8Array(length);
  out.set(data.subarray(0, length));
  return out;
};

const stripsOf = async (info: TiffInfo, bytes: Uint8Array): Promise<Uint8Array[] | null> => {
  const plain = info.compression === 1;
  const deflate = DEFLATE.includes(info.compression);
  const out: Uint8Array[] = [];
  for (const [index, strip] of info.strips.entries()) {
    const raw = bytes.subarray(strip.offset, strip.offset + strip.count);
    const expected = expectedStripBytes(info, index);
    if (plain) {
      out.push(padded(raw, expected));
      continue;
    }
    if (!deflate) {
      out.push(raw);
      continue;
    }
    const inflated = await inflateBounded(raw, expected);
    if (inflated === null) return null;
    out.push(padded(inflated, expected));
  }
  return out;
};

export const runTiff = async (
  id: number,
  buffer: ArrayBuffer,
  usedBytes: number,
  utif: UtifLike,
): Promise<TiffEngineOutput> => {
  const source = new Uint8Array(buffer);
  const header = readTiffInfo(source);
  if (!header.ok) return refusal(id, header.refusal);
  const { info } = header;
  if (usedBytes + workingSetBytes(info, source.length) > DESIGN_LIMITS.rasterBudgetBytes) {
    return refusal(id, TiffRefusal.TooLarge);
  }
  const strips = await stripsOf(info, source);
  if (strips === null) return refusal(id, TiffRefusal.Corrupt);
  const rebuilt = rebuildTiff(info, strips, DEFLATE.includes(info.compression));
  const ifds = utif.decode(rebuilt, { parseMN: false });
  const ifd = ifds[0];
  if (ifd === undefined) return refusal(id, TiffRefusal.Corrupt);
  utif.decodeImage(rebuilt, ifd, ifds);
  if (ifd.width !== info.width || ifd.height !== info.height) {
    return refusal(id, TiffRefusal.Corrupt);
  }
  const rgba = utif.toRGBA8(ifd);
  if (rgba.length !== info.width * info.height * 4) return refusal(id, TiffRefusal.Corrupt);
  const target = targetSize(info);
  const pixels =
    target.width === info.width && target.height === info.height
      ? rgba
      : resample(rgba, info, target);
  const owned = pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + pixels.byteLength);
  if (!(owned instanceof ArrayBuffer)) return refusal(id, TiffRefusal.Corrupt);
  return {
    response: {
      id,
      status: "result",
      width: target.width,
      height: target.height,
      sourceWidth: info.width,
      sourceHeight: info.height,
      pixels: owned,
      bitsPerSample: info.bitsPerSample,
      cmyk: info.photometric === PHOTOMETRIC_CMYK,
      gray:
        info.photometric === PHOTOMETRIC_BLACK_IS_ZERO ||
        info.photometric === PHOTOMETRIC_WHITE_IS_ZERO,
      downscaled: target.width !== info.width || target.height !== info.height,
      ifdCount: info.ifdCount,
    },
    transfer: [owned],
  };
};
