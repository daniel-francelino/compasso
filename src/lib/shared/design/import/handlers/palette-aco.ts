import {
  PALETTE_LIMITS,
  type RawSwatch,
  cmykToRgb,
  decodeUtf16Be,
  finishPalette,
  grayToRgb,
  hsbToRgb,
  labToRgb,
} from "@/lib/shared/design/import/handlers/palette-model";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { hasAcoPalette } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  type ImportHandler,
  type ImportOutcome,
} from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const SECTION_HEADER = 4;
const COLOR_BYTES = 10;
const NAME_HEADER = 4;
const FULL = 65535;
const GRAY_FULL = 10000;
const SPACE_RGB = 0;
const SPACE_HSB = 1;
const SPACE_CMYK = 2;
const SPACE_LAB = 7;
const SPACE_GRAY = 8;

type Section = { swatches: RawSwatch[]; end: number } | null;

const signed = (value: number): number => (value > 0x7fff ? value - 0x10000 : value);

const colorOf = (
  space: number,
  w: number,
  x: number,
  y: number,
  z: number,
  name: string,
): RawSwatch | null => {
  switch (space) {
    case SPACE_RGB:
      return {
        name,
        red: (w / FULL) * 255,
        green: (x / FULL) * 255,
        blue: (y / FULL) * 255,
        converted: false,
      };
    case SPACE_HSB: {
      const [red, green, blue] = hsbToRgb((w / FULL) * 360, x / FULL, y / FULL);
      return { name, red, green, blue, converted: true };
    }
    case SPACE_CMYK: {
      const [red, green, blue] = cmykToRgb(
        (FULL - w) / FULL,
        (FULL - x) / FULL,
        (FULL - y) / FULL,
        (FULL - z) / FULL,
      );
      return { name, red, green, blue, converted: true };
    }
    case SPACE_LAB: {
      const [red, green, blue] = labToRgb(w / 100, signed(x) / 100, signed(y) / 100);
      return { name, red, green, blue, converted: true };
    }
    case SPACE_GRAY: {
      const [red, green, blue] = grayToRgb(w / GRAY_FULL);
      return { name, red, green, blue, converted: true };
    }
    default:
      return null;
  }
};

const readName = (bytes: Uint8Array, offset: number): { name: string; next: number } | null => {
  if (offset + NAME_HEADER > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chars = view.getUint16(offset + 2, false);
  const name = decodeUtf16Be(bytes, offset + NAME_HEADER, chars);
  return name === null ? null : { name, next: offset + NAME_HEADER + chars * 2 };
};

const readSection = (bytes: Uint8Array, start: number, version: 1 | 2): Section => {
  if (start + SECTION_HEADER > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(start, false) !== version) return null;
  const count = view.getUint16(start + 2, false);
  const minimum = version === 1 ? COLOR_BYTES : COLOR_BYTES + NAME_HEADER;
  if (count * minimum > bytes.length - start - SECTION_HEADER) return null;
  const swatches: RawSwatch[] = [];
  let offset = start + SECTION_HEADER;
  for (let index = 0; index < count; index += 1) {
    if (offset + COLOR_BYTES > bytes.length) return null;
    const space = view.getUint16(offset, false);
    const values = [2, 4, 6, 8].map((delta) => view.getUint16(offset + delta, false));
    offset += COLOR_BYTES;
    const named = version === 2 ? readName(bytes, offset) : { name: "", next: offset };
    if (named === null) return null;
    const { name } = named;
    offset = named.next;
    const color = colorOf(
      space,
      values[0] ?? 0,
      values[1] ?? 0,
      values[2] ?? 0,
      values[3] ?? 0,
      name,
    );
    if (color !== null) swatches.push(color);
  }
  return { swatches, end: offset };
};

export const parseAco = (bytes: Uint8Array): Result<ImportOutcome> => {
  const first = readSection(bytes, 0, 1);
  const second = readSection(bytes, first?.end ?? 0, 2);
  const chosen = second ?? first;
  return chosen === null
    ? invalid(DESIGN_IMPORT_MESSAGE.paletteCorrupt)
    : finishPalette(chosen.swatches);
};

export const acoHandler: ImportHandler = {
  format: DesignImportFormat.Aco,
  kind: DesignImportKind.Palette,
  extensions: ["aco"],
  maxBytes: PALETTE_LIMITS.maxBytes,
  runsIn: "main",
  sniff: hasAcoPalette,
  decode: async ({ bytes }) => parseAco(bytes),
};
