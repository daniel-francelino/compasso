import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { type Result, invalid } from "@/lib/shared/server-utils";

export const DESIGN_IMPORT_LIMITS = {
  maxPageSide: 4096,
  minPageSide: 64,
  maxLayerSide: 16384,
  workerTimeoutMs: 60_000,
  pdfTimeoutMs: 30_000,
  pdfHeaderWindowBytes: 1024,
  jpegHeaderWindowBytes: 256 * 1024,
  aiTargetScale: 2,
  aiMaxImagePixels: 16_777_216,
} as const;

const MIB = 1024 * 1024;

export const SKETCH_LIMITS = {
  maxFileBytes: 100 * MIB,
  maxEntries: 2000,
  maxTotalBytes: 256 * MIB,
  maxPageJsonBytes: 32 * MIB,
  maxDocumentJsonBytes: 4 * MIB,
  maxImageBytes: 64 * MIB,
  ratioLimit: 200,
  ratioFloorBytes: MIB,
  eocdWindowBytes: 64 * 1024,
  maxNameLength: 255,
  maxJsonDepth: 128,
  maxJsonValues: 2_000_000,
  maxArtboardsListed: 100,
  maxSymbolDepth: 1,
  maxImagePixels: 64 * MIB,
  minFormatVersion: 88,
  timeoutMs: 30_000,
} as const;

export const SVG_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxElements: 5000,
  maxUse: 50,
  maxDepth: 64,
  maxStyleChars: 100_000,
  maxDeclaredSide: 1_000_000,
  maxScale: 2,
  renderTimeoutMs: 10_000,
  headWindowBytes: 1024,
} as const;

export const sizeFitsPage = (width: number, height: number): Result<object> => {
  const { maxPageSide, minPageSide } = DESIGN_IMPORT_LIMITS;
  if (width > maxPageSide || height > maxPageSide) {
    return invalid(DESIGN_IMPORT_MESSAGE.canvasTooLarge(maxPageSide));
  }
  if (width < minPageSide || height < minPageSide) {
    return invalid(DESIGN_IMPORT_MESSAGE.canvasTooSmall(minPageSide));
  }
  return { ok: true };
};
