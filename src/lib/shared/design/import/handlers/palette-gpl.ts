import {
  PALETTE_LIMITS,
  type RawSwatch,
  finishPalette,
} from "@/lib/shared/design/import/handlers/palette-model";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { hasGplPalette } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  type ImportHandler,
  type ImportOutcome,
} from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const HEADER = "GIMP Palette";
const COLOR_LINE = /^\s*(\d{1,5})\s+(\d{1,5})\s+(\d{1,5})(?:\s+(.*))?$/;

export const parseGpl = (bytes: Uint8Array): Result<ImportOutcome> => {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const lines = text.split(/\r\n|\r|\n/);
  const refuse = (): Result<ImportOutcome> => invalid(DESIGN_IMPORT_MESSAGE.paletteCorrupt);
  if (lines.length > PALETTE_LIMITS.maxGplLines) return refuse();
  if (!(lines[0] ?? "").startsWith(HEADER)) return refuse();
  const swatches: RawSwatch[] = [];
  for (const line of lines.slice(1)) {
    if (line.length > PALETTE_LIMITS.maxGplLineChars) return refuse();
    const match = COLOR_LINE.exec(line);
    if (match === null) continue;
    const [, red, green, blue, name] = match;
    swatches.push({
      name: name ?? "",
      red: Math.min(255, Number(red)),
      green: Math.min(255, Number(green)),
      blue: Math.min(255, Number(blue)),
      converted: false,
    });
  }
  return finishPalette(swatches);
};

export const gplHandler: ImportHandler = {
  format: DesignImportFormat.Gpl,
  kind: DesignImportKind.Palette,
  extensions: ["gpl"],
  maxBytes: PALETTE_LIMITS.maxBytes,
  runsIn: "main",
  sniff: hasGplPalette,
  decode: async ({ bytes }) => parseGpl(bytes),
};
