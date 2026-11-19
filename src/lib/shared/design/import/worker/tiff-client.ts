import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE, IMPORT_CANCELLED } from "@/lib/shared/design/import/messages";
import { runWorkerJob } from "@/lib/shared/design/import/worker/run-worker-job";
import { TiffRefusal } from "@/lib/shared/design/import/worker/tiff-header";
import {
  TiffResponseSchema,
  type TiffRequest,
  type TiffResponse,
} from "@/lib/shared/design/import/worker/tiff-protocol";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import { logError } from "@/lib/shared/logger";
import { type Result, invalid } from "@/lib/shared/server-utils";

export type TiffResult = Extract<TiffResponse, { status: "result" }>;

const createWorker = (): Worker =>
  new Worker(new URL("./tiff.worker.ts", import.meta.url), { type: "module" });

const refusalMessage = (refusal: TiffRefusal): string => {
  switch (refusal) {
    case TiffRefusal.TooLarge:
      return DESIGN_IMPORT_MESSAGE.tiffTooLarge;
    case TiffRefusal.Unsupported:
      return DESIGN_IMPORT_MESSAGE.tiffUnsupported;
    case TiffRefusal.Corrupt:
      return DESIGN_IMPORT_MESSAGE.tiffCorrupt;
  }
};

export const validateTiffResult = (
  response: TiffResult,
  usedBytes: number,
): Result<{ result: TiffResult }> => {
  const bytes = rasterBytes(response.width, response.height);
  const consistent =
    response.pixels.byteLength === bytes && bytes <= DESIGN_LIMITS.rasterBudgetBytes;
  if (!consistent) return invalid(DESIGN_IMPORT_MESSAGE.tiffCorrupt);
  if (usedBytes + rasterBytes(response.width, response.height) > DESIGN_LIMITS.rasterBudgetBytes) {
    return invalid(DESIGN_IMPORT_MESSAGE.memory);
  }
  return { ok: true, result: response };
};

export const runTiffJob = (
  request: Omit<TiffRequest, "id">,
  signal: AbortSignal | undefined,
  timeoutMs: number = DESIGN_IMPORT_LIMITS.tiffTimeoutMs,
): Promise<Result<{ result: TiffResult }>> =>
  runWorkerJob<Result<{ result: TiffResult }>>({
    label: "tiff worker",
    create: createWorker,
    request: { id: 0, ...request },
    timeoutMs,
    signal,
    readFailed: () => invalid(DESIGN_IMPORT_MESSAGE.readFailed),
    timedOut: () => invalid(DESIGN_IMPORT_MESSAGE.timedOut),
    cancelled: () => IMPORT_CANCELLED,
    onMessage: (data, finish) => {
      const parsed = TiffResponseSchema.safeParse(data);
      if (!parsed.success) {
        logError("tiff worker response invalid", "ZodError");
        finish(invalid(DESIGN_IMPORT_MESSAGE.readFailed));
        return;
      }
      const response = parsed.data;
      if (response.id !== 0) return;
      finish(
        response.status === "error"
          ? invalid(refusalMessage(response.refusal))
          : validateTiffResult(response, request.usedBytes),
      );
    },
  });
