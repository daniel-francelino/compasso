import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import type { DocumentInitParameters } from "pdfjs-dist/types/src/display/api";
import { DESIGN_IMPORT_LIMITS, sizeFitsPage } from "@/lib/shared/design/import/limits";
import { buildMetadata } from "@/lib/shared/design/import/metadata";
import {
  DESIGN_IMPORT_LAYER_NAME,
  DESIGN_IMPORT_MESSAGE,
  IMPORT_CANCELLED,
} from "@/lib/shared/design/import/messages";
import {
  ImportAbortedError,
  ImportTimeoutError,
  errorName,
  raceWithLimits,
} from "@/lib/shared/design/import/run-limits";
import { singleLayerDesign } from "@/lib/shared/design/import/single-layer";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import { findPdfStart } from "@/lib/shared/design/import/sniff";
import {
  DesignImportColorMode,
  DesignImportNoteKind,
  type DesignImportFormat,
  type ImportKindResult,
  type ImportNote,
} from "@/lib/shared/design/import/types";
import { logError } from "@/lib/shared/logger";
import { type Result, invalid } from "@/lib/shared/server-utils";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const PASSWORD_ERROR = "PasswordException";
const TRANSPARENT = "rgba(0,0,0,0)";

export type PdfPage = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  pageCount: number;
  naturalWidth: number;
  naturalHeight: number;
};

export const extractPdfBytes = (bytes: Uint8Array): Uint8Array | null => {
  const offset = findPdfStart(bytes);
  if (offset === null) return null;
  return offset === 0 ? bytes : bytes.subarray(offset);
};

export const buildPdfOpenOptions = (data: Uint8Array): DocumentInitParameters => ({
  data,
  disableAutoFetch: true,
  disableStream: true,
  disableRange: true,
  enableXfa: false,
  useWorkerFetch: false,
  stopAtErrors: false,
  maxImageSize: DESIGN_IMPORT_LIMITS.aiMaxImagePixels,
  verbosity: 0,
});

export const pageRenderSize = (
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

const isUsableSide = (side: number): boolean => Number.isFinite(side) && side > 0;

const ownedBytes = (bytes: Uint8Array): Uint8Array =>
  bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();

const failureOf = (error: unknown, renderFailure: string): Result<PdfPage> => {
  if (error instanceof ImportAbortedError) return IMPORT_CANCELLED;
  if (error instanceof ImportTimeoutError) return invalid(DESIGN_IMPORT_MESSAGE.timedOut);
  if (error instanceof Error && error.name === PASSWORD_ERROR) {
    return invalid(DESIGN_IMPORT_MESSAGE.encrypted);
  }
  logError("pdf render failed", errorName(error));
  return invalid(renderFailure);
};

const drawFirstPage = async (
  task: PDFDocumentLoadingTask,
  usedBytes: number,
  renderFailure: string,
): Promise<Result<PdfPage>> => {
  const document = await task.promise;
  const page = await document.getPage(1);
  const natural = page.getViewport({ scale: 1 });
  if (!isUsableSide(natural.width) || !isUsableSide(natural.height)) {
    return invalid(renderFailure);
  }
  if (
    natural.width > DESIGN_IMPORT_LIMITS.maxLayerSide ||
    natural.height > DESIGN_IMPORT_LIMITS.maxLayerSide
  ) {
    return invalid(DESIGN_IMPORT_MESSAGE.canvasTooLarge(DESIGN_IMPORT_LIMITS.maxPageSide));
  }
  const size = pageRenderSize(natural.width, natural.height);
  const fits = sizeFitsPage(size.width, size.height);
  if (!fits.ok) return fits;
  if (usedBytes + rasterBytes(size.width, size.height) > DESIGN_LIMITS.rasterBudgetBytes) {
    return invalid(DESIGN_IMPORT_MESSAGE.memory);
  }
  const canvas = globalThis.document.createElement("canvas");
  try {
    canvas.width = size.width;
    canvas.height = size.height;
    const viewport = page.getViewport({ scale: size.scale });
    await page.render({ canvas, viewport, background: TRANSPARENT }).promise;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) return invalid(renderFailure);
    const pixels = context.getImageData(0, 0, size.width, size.height);
    return {
      ok: true,
      width: size.width,
      height: size.height,
      data: pixels.data,
      pageCount: document.numPages,
      naturalWidth: natural.width,
      naturalHeight: natural.height,
    };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
};

export const renderPdfPage = async (
  bytes: Uint8Array,
  options: {
    usedBytes: number;
    renderFailure: string;
    timeoutMs?: number;
    signal?: AbortSignal | undefined;
  },
): Promise<Result<PdfPage>> => {
  if (options.signal?.aborted === true) return IMPORT_CANCELLED;
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument(buildPdfOpenOptions(ownedBytes(bytes)));
  const work = drawFirstPage(task, options.usedBytes, options.renderFailure);
  try {
    return await raceWithLimits(work, {
      timeoutMs: options.timeoutMs ?? DESIGN_IMPORT_LIMITS.pdfTimeoutMs,
      signal: options.signal,
    });
  } catch (error) {
    return failureOf(error, options.renderFailure);
  } finally {
    await task.destroy();
  }
};

const pdfPageNotes = (pageCount: number): ImportNote[] =>
  pageCount > 1 ? [{ kind: DesignImportNoteKind.FirstPageOnly, count: 1 }] : [];

const pdfMetadata = (format: DesignImportFormat, page: PdfPage) =>
  buildMetadata({
    source: {
      format,
      colorMode: DesignImportColorMode.Unknown,
      bitsPerChannel: null,
      pageCount: page.pageCount,
    },
    dimensions: {
      sourceWidth: page.naturalWidth,
      sourceHeight: page.naturalHeight,
      pageWidth: page.width,
      pageHeight: page.height,
    },
  });

export const renderPdfPageDesign = async (
  format: DesignImportFormat,
  input: {
    bytes: Uint8Array;
    fileName: string;
    newId: () => string;
    usedBytes: number;
    notPdf?: string;
    signal?: AbortSignal | undefined;
  },
  renderFailure: string,
): Promise<Result<ImportKindResult>> => {
  const pdf = extractPdfBytes(input.bytes);
  if (pdf === null) return invalid(input.notPdf ?? DESIGN_IMPORT_MESSAGE.corrupt);
  const rendered = await renderPdfPage(pdf, {
    usedBytes: input.usedBytes,
    renderFailure,
    signal: input.signal,
  });
  if (!rendered.ok) return rendered;
  return {
    ok: true,
    ...singleLayerDesign(format, rendered, {
      newId: input.newId,
      fileName: input.fileName,
      notes: pdfPageNotes(rendered.pageCount),
      defaultName: DESIGN_IMPORT_LAYER_NAME.art,
      metadata: pdfMetadata(format, rendered),
    }),
  };
};
