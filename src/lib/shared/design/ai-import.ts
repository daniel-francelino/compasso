import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  DESIGN_IMPORT_LIMITS,
  DESIGN_IMPORT_MESSAGE,
  DesignImportFormat,
  type ImportedDesign,
  importBaseName,
  sizeFitsPage,
} from "@/lib/shared/design/design-import";
import { createRasterLayer, emptyPage } from "@/lib/shared/design/document";
import { logError } from "@/lib/shared/logger";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import { type Result, invalid } from "@/lib/shared/server-utils";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const PDF_MARKER = "%PDF-";
const PASSWORD_ERROR = "PasswordException";
const TRANSPARENT = "rgba(0,0,0,0)";
const AI_NOTES = [
  "O arquivo .ai foi importado como uma única camada de pixels (a primeira prancheta); o vetor não é editável.",
];

const markerAt = (bytes: Uint8Array, offset: number): boolean => {
  for (let index = 0; index < PDF_MARKER.length; index += 1) {
    if (bytes[offset + index] !== PDF_MARKER.charCodeAt(index)) return false;
  }
  return true;
};

export const extractPdfBytes = (bytes: Uint8Array): Uint8Array | null => {
  const last = bytes.length - PDF_MARKER.length;
  for (let offset = 0; offset <= last; offset += 1) {
    if (bytes[offset] === PDF_MARKER.charCodeAt(0) && markerAt(bytes, offset)) {
      return offset === 0 ? bytes : bytes.subarray(offset);
    }
  }
  return null;
};

export const aiRenderSize = (
  width: number,
  height: number,
): { scale: number; width: number; height: number } => {
  const longest = Math.max(width, height, 1);
  const scale = Math.min(
    DESIGN_IMPORT_LIMITS.aiTargetScale,
    DESIGN_IMPORT_LIMITS.maxPageSide / longest,
  );
  return {
    scale,
    width: Math.min(DESIGN_IMPORT_LIMITS.maxPageSide, Math.floor(width * scale)),
    height: Math.min(DESIGN_IMPORT_LIMITS.maxPageSide, Math.floor(height * scale)),
  };
};

const failureOf = (error: unknown): Result<{ design: ImportedDesign }> => {
  if (error instanceof Error && error.name === PASSWORD_ERROR) {
    return invalid(DESIGN_IMPORT_MESSAGE.aiEncrypted);
  }
  logError("ai import failed", error);
  return invalid(DESIGN_IMPORT_MESSAGE.aiRender);
};

export const renderAiFile = async (
  bytes: Uint8Array,
  fileName: string,
  newId: () => string,
): Promise<Result<{ design: ImportedDesign }>> => {
  const pdf = extractPdfBytes(bytes);
  if (pdf === null) return invalid(DESIGN_IMPORT_MESSAGE.aiNotPdf);
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({
    data: pdf.slice(),
    stopAtErrors: false,
    maxImageSize: DESIGN_IMPORT_LIMITS.aiMaxImagePixels,
  });
  try {
    const document = await task.promise;
    const page = await document.getPage(1);
    const natural = page.getViewport({ scale: 1 });
    const size = aiRenderSize(natural.width, natural.height);
    const fits = sizeFitsPage(size.width, size.height);
    if (!fits.ok) return fits;
    const canvas = globalThis.document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const viewport = page.getViewport({ scale: size.scale });
    await page.render({ canvas, viewport, background: TRANSPARENT }).promise;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) return invalid(DESIGN_IMPORT_MESSAGE.aiRender);
    const pixels = context.getImageData(0, 0, size.width, size.height);
    canvas.width = 0;
    canvas.height = 0;
    const buffer: PixelBuffer = { width: size.width, height: size.height, data: pixels.data };
    const id = newId();
    const name = importBaseName(fileName).slice(0, DESIGN_LIMITS.layerNameMax) || "Arte";
    const element = {
      ...createRasterLayer(id, emptyPage("import"), size),
      name,
      pixelWidth: size.width,
      pixelHeight: size.height,
    };
    return {
      ok: true,
      design: {
        format: DesignImportFormat.Ai,
        width: size.width,
        height: size.height,
        elements: [element],
        buffers: new Map([[id, buffer]]),
        notes: AI_NOTES,
      },
    };
  } catch (error) {
    return failureOf(error);
  } finally {
    await task.destroy();
  }
};
