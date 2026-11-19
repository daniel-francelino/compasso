import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { SketchRefusal } from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

export const DESIGN_IMPORT_LIMITS = {
  maxPageSide: 4096,
  minPageSide: 64,
  maxLayerSide: 16384,
  workerTimeoutMs: 60_000,
  pdfTimeoutMs: 30_000,
  tiffTimeoutMs: 20_000,
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
  maxJobJsonValues: 8_000_000,
  maxBitmapDecodes: 32,
  maxArtboardsListed: 100,
  maxSymbolDepth: 1,
  maxImagePixels: 64 * MIB,
  maxRenderCost: 1_000_000_000,
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

export const SVG_VECTOR_LIMITS = {
  maxFileBytes: SVG_LIMITS.maxFileBytes,
  maxNodes: 5000,
  maxDepth: 32,
  maxUseExpansions: 200,
  maxNumber: 1_000_000,
  timeBudgetMs: 2000,
  maxStyleChars: SVG_LIMITS.maxStyleChars,
  maxStyleRules: 2000,
  maxStyleDeclarations: 2000,
  maxStyleWork: 100_000,
  maxAttributesPerElement: 64,
  maxAttributeChars: 4096,
  maxDataAttributeChars: 524_288,
  maxNumberChars: 32,
  maxDeclarationChars: 1024,
  maxPaintChars: 256,
} as const;

export const pageSizeRefusal = (
  width: number,
  height: number,
): { refusal: SketchRefusal; limit: number } | null => {
  const { maxPageSide, minPageSide } = DESIGN_IMPORT_LIMITS;
  if (width > maxPageSide || height > maxPageSide) {
    return { refusal: SketchRefusal.CanvasTooLarge, limit: maxPageSide };
  }
  if (width < minPageSide || height < minPageSide) {
    return { refusal: SketchRefusal.CanvasTooSmall, limit: minPageSide };
  }
  return null;
};

export const sizeFitsPage = (width: number, height: number): Result<object> => {
  const refused = pageSizeRefusal(width, height);
  if (refused === null) return { ok: true };
  return invalid(
    refused.refusal === SketchRefusal.CanvasTooLarge
      ? DESIGN_IMPORT_MESSAGE.canvasTooLarge(refused.limit)
      : DESIGN_IMPORT_MESSAGE.canvasTooSmall(refused.limit),
  );
};
