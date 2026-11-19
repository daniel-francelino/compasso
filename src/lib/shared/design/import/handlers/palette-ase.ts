import {
  PALETTE_LIMITS,
  type RawSwatch,
  cmykToRgb,
  decodeUtf16Be,
  finishPalette,
  grayToRgb,
  labToRgb,
} from "@/lib/shared/design/import/handlers/palette-model";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { hasAsePalette } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  type ImportHandler,
  type ImportOutcome,
} from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const HEADER_BYTES = 12;
const BLOCK_HEADER_BYTES = 6;
const GROUP_START = 0xc001;
const GROUP_END = 0xc002;
const COLOR_ENTRY = 0x0001;
const MODEL_BYTES = 4;
const COLOR_TYPE_BYTES = 2;
const NAME_SEPARATOR = " / ";
const MAX_GROUP_DEPTH = 8;

const corrupt = (): Result<ImportOutcome> => invalid(DESIGN_IMPORT_MESSAGE.paletteCorrupt);

const modelOf = (bytes: Uint8Array, offset: number): string =>
  String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );

const readColor = (
  view: DataView,
  bytes: Uint8Array,
  offset: number,
  end: number,
  name: string,
): RawSwatch | null => {
  const model = modelOf(bytes, offset);
  const values = model === "CMYK" ? 4 : model === "Gray" ? 1 : 3;
  if (!["RGB ", "CMYK", "LAB ", "Gray"].includes(model)) return null;
  if (offset + MODEL_BYTES + values * 4 + COLOR_TYPE_BYTES > end) return null;
  const read = (index: number): number => view.getFloat32(offset + MODEL_BYTES + index * 4, false);
  if (model === "RGB ") {
    return {
      name,
      red: read(0) * 255,
      green: read(1) * 255,
      blue: read(2) * 255,
      converted: false,
    };
  }
  const [red, green, blue] =
    model === "CMYK"
      ? cmykToRgb(read(0), read(1), read(2), read(3))
      : model === "Gray"
        ? grayToRgb(read(0))
        : labToRgb(read(0) * 100, read(1), read(2));
  return { name, red, green, blue, converted: true };
};

const pushGroup = (groups: string[], name: string): boolean => {
  if (groups.length >= MAX_GROUP_DEPTH) return false;
  groups.push(name);
  return true;
};

export const parseAse = (bytes: Uint8Array): Result<ImportOutcome> => {
  if (bytes.length < HEADER_BYTES || !hasAsePalette(bytes)) return corrupt();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const blockCount = view.getUint32(8, false);
  if (blockCount > (bytes.length - HEADER_BYTES) / BLOCK_HEADER_BYTES) return corrupt();
  const groups: string[] = [];
  const swatches: RawSwatch[] = [];
  let offset = HEADER_BYTES;
  for (let index = 0; index < blockCount; index += 1) {
    if (offset + BLOCK_HEADER_BYTES > bytes.length) return corrupt();
    const type = view.getUint16(offset, false);
    const length = view.getUint32(offset + 2, false);
    const start = offset + BLOCK_HEADER_BYTES;
    const end = start + length;
    if (end > bytes.length) return corrupt();
    offset = end;
    if (type === GROUP_END) {
      groups.pop();
      continue;
    }
    if (type !== GROUP_START && type !== COLOR_ENTRY) continue;
    if (length < 2) return corrupt();
    const chars = view.getUint16(start, false);
    if (start + 2 + chars * 2 > end) return corrupt();
    const name = decodeUtf16Be(bytes, start + 2, chars);
    if (name === null) return corrupt();
    const isGroup = type === GROUP_START;
    if (isGroup && !pushGroup(groups, name)) return corrupt();
    if (isGroup) continue;
    const label = [...groups, name].filter((part) => part !== "").join(NAME_SEPARATOR);
    const color = readColor(view, bytes, start + 2 + chars * 2, end, label);
    if (color !== null) swatches.push(color);
  }
  return finishPalette(swatches);
};

export const aseHandler: ImportHandler = {
  format: DesignImportFormat.Ase,
  kind: DesignImportKind.Palette,
  extensions: ["ase"],
  maxBytes: PALETTE_LIMITS.maxBytes,
  runsIn: "main",
  sniff: hasAsePalette,
  decode: async ({ bytes }) => parseAse(bytes),
};
