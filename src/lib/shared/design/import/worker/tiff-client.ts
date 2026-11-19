import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE, IMPORT_CANCELLED } from "@/lib/shared/design/import/messages";
import { errorName } from "@/lib/shared/design/import/run-limits";
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
  const bytes = response.width * response.height * 4;
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
  new Promise((resolve) => {
    if (signal?.aborted === true) {
      resolve(IMPORT_CANCELLED);
      return;
    }
    if (typeof Worker === "undefined") {
      resolve(invalid(DESIGN_IMPORT_MESSAGE.readFailed));
      return;
    }
    let worker: Worker;
    try {
      worker = createWorker();
    } catch (error) {
      logError("tiff worker start failed", errorName(error));
      resolve(invalid(DESIGN_IMPORT_MESSAGE.readFailed));
      return;
    }
    let settled = false;
    const finish = (outcome: Result<{ result: TiffResult }>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      resolve(outcome);
    };
    const onAbort = (): void => finish(IMPORT_CANCELLED);
    const timer = setTimeout(() => finish(invalid(DESIGN_IMPORT_MESSAGE.timedOut)), timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    const fail = (label: string, event: Event): void => {
      logError(label, event.type);
      finish(invalid(DESIGN_IMPORT_MESSAGE.readFailed));
    };
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (settled) return;
      const parsed = TiffResponseSchema.safeParse(event.data);
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
    };
    worker.onerror = (event) => fail("tiff worker failed", event);
    worker.onmessageerror = (event) => fail("tiff worker message failed", event);
    worker.postMessage({ id: 0, ...request });
  });
