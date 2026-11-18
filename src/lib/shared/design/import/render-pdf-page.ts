import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import type { DocumentInitParameters } from "pdfjs-dist/types/src/display/api";
import { DESIGN_IMPORT_LIMITS, sizeFitsPage } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { findPdfStart, importBaseName } from "@/lib/shared/design/import/sniff";
import {
  DesignImportKind,
  DesignImportNoteKind,
  type DesignImportFormat,
  type ImportKindResult,
  type ImportNote,
} from "@/lib/shared/design/import/types";
import { createRasterLayer, emptyPage } from "@/lib/shared/design/document";
import { logError } from "@/lib/shared/logger";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import { type Result, invalid } from "@/lib/shared/server-utils";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const PASSWORD_ERROR = "PasswordException";
const TRANSPARENT = "rgba(0,0,0,0)";
const BYTES_PER_PIXEL = 4;
const DEFAULT_LAYER_NAME = "Arte";

class PdfTimeout extends Error {}

class PdfCancelled extends Error {}

export type PdfPage = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  pageCount: number;
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
  if (error instanceof PdfCancelled) return invalid(DESIGN_IMPORT_MESSAGE.cancelled);
  if (error instanceof PdfTimeout) return invalid(DESIGN_IMPORT_MESSAGE.timedOut);
  if (error instanceof Error && error.name === PASSWORD_ERROR) {
    return invalid(DESIGN_IMPORT_MESSAGE.encrypted);
  }
  logError("pdf render failed", error);
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
    return invalid(DESIGN_IMPORT_MESSAGE.canvasTooLarge);
  }
  const size = pageRenderSize(natural.width, natural.height);
  const fits = sizeFitsPage(size.width, size.height);
  if (!fits.ok) return fits;
  if (usedBytes + size.width * size.height * BYTES_PER_PIXEL > DESIGN_LIMITS.rasterBudgetBytes) {
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
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument(buildPdfOpenOptions(ownedBytes(bytes)));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (reason: Error) => void = () => undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    cancel = reject;
    timer = setTimeout(
      () => reject(new PdfTimeout()),
      options.timeoutMs ?? DESIGN_IMPORT_LIMITS.pdfTimeoutMs,
    );
  });
  const onAbort = (): void => cancel(new PdfCancelled());
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted === true) onAbort();
  const work = drawFirstPage(task, options.usedBytes, options.renderFailure);
  work.catch(() => undefined);
  try {
    return await Promise.race([work, expiry]);
  } catch (error) {
    return failureOf(error, options.renderFailure);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
    await task.destroy();
  }
};

const pdfPageNotes = (pageCount: number): ImportNote[] =>
  pageCount > 1 ? [{ kind: DesignImportNoteKind.FirstPageOnly, count: 1 }] : [];

export const renderPdfPageDesign = async (
  format: DesignImportFormat,
  input: {
    bytes: Uint8Array;
    fileName: string;
    newId: () => string;
    usedBytes: number;
    signal?: AbortSignal | undefined;
  },
  renderFailure: string,
): Promise<Result<ImportKindResult>> => {
  const pdf = extractPdfBytes(input.bytes);
  if (pdf === null) return invalid(DESIGN_IMPORT_MESSAGE.corrupt);
  const rendered = await renderPdfPage(pdf, {
    usedBytes: input.usedBytes,
    renderFailure,
    signal: input.signal,
  });
  if (!rendered.ok) return rendered;
  const size = { width: rendered.width, height: rendered.height };
  const buffer: PixelBuffer = { ...size, data: rendered.data };
  const id = input.newId();
  const name =
    importBaseName(input.fileName).slice(0, DESIGN_LIMITS.layerNameMax) || DEFAULT_LAYER_NAME;
  const element = {
    ...createRasterLayer(id, emptyPage("import"), size),
    name,
    pixelWidth: size.width,
    pixelHeight: size.height,
  };
  return {
    ok: true,
    kind: DesignImportKind.Image,
    design: {
      format,
      ...size,
      elements: [element],
      buffers: new Map([[id, buffer]]),
      notes: pdfPageNotes(rendered.pageCount),
    },
  };
};
