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
