import {
  type ImageHeader,
  orientedSize,
  readImageHeader,
} from "@/lib/shared/design/import/handlers/image-header";
import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import {
  DESIGN_IMPORT_LAYER_NAME,
  DESIGN_IMPORT_MESSAGE,
  IMPORT_CANCELLED,
} from "@/lib/shared/design/import/messages";
import {
  ImportAbortedError,
  errorName,
  raceWithLimits,
} from "@/lib/shared/design/import/run-limits";
import { singleLayerDesign } from "@/lib/shared/design/import/single-layer";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import {
  hasJpegSignature,
  hasPngSignature,
  hasWebpSignature,
} from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  DesignImportNoteKind,
  type ImportHandler,
  type ImportInput,
  type ImportKindResult,
  type ImportNote,
} from "@/lib/shared/design/import/types";
import { logError } from "@/lib/shared/logger";
import { type Result, invalid } from "@/lib/shared/server-utils";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

type Size = { width: number; height: number };

export type ImagePlan = {
  target: Size;
  acceptable: readonly Size[];
  downscaled: boolean;
  animated: boolean;
};

export type DecodedPixels = Size & { data: Uint8ClampedArray };

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const ORIENTATION_FROM_IMAGE = "from-image";

const targetSize = (size: Size): { size: Size; downscaled: boolean } => {
  const longest = Math.max(size.width, size.height);
  if (longest <= DESIGN_IMPORT_LIMITS.maxPageSide) return { size, downscaled: false };
  const scale = DESIGN_IMPORT_LIMITS.maxPageSide / longest;
  const scaled = (side: number): number =>
    Math.min(DESIGN_IMPORT_LIMITS.maxPageSide, Math.max(1, Math.round(side * scale)));
  return { size: { width: scaled(size.width), height: scaled(size.height) }, downscaled: true };
};

export const planImage = (header: ImageHeader, usedBytes: number): Result<{ plan: ImagePlan }> => {
  const declared = orientedSize(header);
  const { maxLayerSide, minPageSide } = DESIGN_IMPORT_LIMITS;
  const sideOver = (size: Size): boolean => Math.max(size.width, size.height) > maxLayerSide;
  const either = [declared, { width: declared.height, height: declared.width }];
  const checked = header.orientationKnown ? [declared] : either;
  if (checked.some(sideOver)) {
    return invalid(DESIGN_IMPORT_MESSAGE.imageTooLarge(header.width, header.height));
  }
  const declaredBytes = rasterBytes(header.width, header.height);
  if (declaredBytes > DESIGN_LIMITS.rasterBudgetBytes) {
    return invalid(DESIGN_IMPORT_MESSAGE.imageTooLarge(header.width, header.height));
  }
  if (usedBytes + declaredBytes > DESIGN_LIMITS.rasterBudgetBytes) {
    return invalid(DESIGN_IMPORT_MESSAGE.memory);
  }
  if (declared.width < minPageSide || declared.height < minPageSide) {
    return invalid(DESIGN_IMPORT_MESSAGE.canvasTooSmall(minPageSide));
  }
  const { size, downscaled } = targetSize(declared);
  const swapped = { width: size.height, height: size.width };
  return {
    ok: true,
    plan: {
      target: size,
      acceptable: header.orientationKnown ? [size] : [size, swapped],
      downscaled,
      animated: header.animated,
    },
  };
};

const isExpectedSize = (plan: ImagePlan, size: Size): boolean =>
  plan.acceptable.some((entry) => entry.width === size.width && entry.height === size.height);

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const copyPixels = (context: Context2D | null, bitmap: ImageBitmap): ImageData | null => {
  if (context === null) return null;
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
};

const offscreenPixels = (bitmap: ImageBitmap): ImageData | null => {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  try {
    return copyPixels(canvas.getContext("2d", { willReadFrequently: true }), bitmap);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
};

const documentPixels = (bitmap: ImageBitmap): ImageData | null => {
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  try {
    return copyPixels(canvas.getContext("2d", { willReadFrequently: true }), bitmap);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
};

const readPixels = (bitmap: ImageBitmap): ImageData | null =>
  typeof OffscreenCanvas === "undefined" ? documentPixels(bitmap) : offscreenPixels(bitmap);

const bitmapOptions = (plan: ImagePlan): ImageBitmapOptions =>
  plan.downscaled
    ? {
        imageOrientation: ORIENTATION_FROM_IMAGE,
        resizeWidth: plan.target.width,
        resizeHeight: plan.target.height,
        resizeQuality: "high",
      }
    : { imageOrientation: ORIENTATION_FROM_IMAGE };

const decodePixels = async (file: Blob, plan: ImagePlan): Promise<Result<DecodedPixels>> => {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, bitmapOptions(plan));
    const size = { width: bitmap.width, height: bitmap.height };
    if (!isExpectedSize(plan, size)) return invalid(DESIGN_IMPORT_MESSAGE.imageCorrupt);
    const pixels = readPixels(bitmap);
    if (pixels === null || !isExpectedSize(plan, pixels)) {
      return invalid(DESIGN_IMPORT_MESSAGE.imageCorrupt);
    }
    return { ok: true, width: pixels.width, height: pixels.height, data: pixels.data };
  } catch (error) {
    logError("image decode failed", errorName(error));
    return invalid(DESIGN_IMPORT_MESSAGE.imageCorrupt);
  } finally {
    bitmap?.close();
  }
};

const decodeWithLimits = async (
  file: Blob,
  plan: ImagePlan,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Result<DecodedPixels>> => {
  if (signal?.aborted === true) return IMPORT_CANCELLED;
  try {
    return await raceWithLimits(decodePixels(file, plan), { timeoutMs, signal });
  } catch (error) {
    return error instanceof ImportAbortedError
      ? IMPORT_CANCELLED
      : invalid(DESIGN_IMPORT_MESSAGE.timedOut);
  }
};

const notesOf = (plan: ImagePlan): ImportNote[] => [
  ...(plan.downscaled ? [{ kind: DesignImportNoteKind.Downscaled, count: 1 }] : []),
  ...(plan.animated ? [{ kind: DesignImportNoteKind.AnimationIgnored, count: 1 }] : []),
];

export const decodeImage = async (
  format: DesignImportFormat,
  input: ImportInput,
): Promise<Result<ImportKindResult>> => {
  const header = readImageHeader(input.bytes, format);
  if (!header.ok) return header;
  const planned = planImage(header.header, input.usedBytes);
  if (!planned.ok) return planned;
  const { plan } = planned;
  const decoded = await decodeWithLimits(
    input.file,
    plan,
    input.signal,
    DESIGN_IMPORT_LIMITS.workerTimeoutMs,
  );
  if (!decoded.ok) return decoded;
  return {
    ok: true,
    ...singleLayerDesign(format, decoded, {
      newId: input.newId,
      fileName: input.file.name,
      notes: notesOf(plan),
      defaultName: DESIGN_IMPORT_LAYER_NAME.image,
    }),
  };
};

const imageHandler = (
  format: DesignImportFormat,
  extensions: readonly string[],
  sniff: (head: Uint8Array) => boolean,
): ImportHandler => ({
  format,
  kind: DesignImportKind.Image,
  extensions,
  maxBytes: MAX_IMAGE_BYTES,
  runsIn: "main",
  headBytes: DESIGN_IMPORT_LIMITS.jpegHeaderWindowBytes,
  sniff,
  decode: (input) => decodeImage(format, input),
});

export const pngHandler = imageHandler(DesignImportFormat.Png, ["png"], hasPngSignature);
export const jpegHandler = imageHandler(DesignImportFormat.Jpeg, ["jpg", "jpeg"], hasJpegSignature);
export const webpHandler = imageHandler(DesignImportFormat.Webp, ["webp"], hasWebpSignature);
