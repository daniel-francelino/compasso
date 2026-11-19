import { SKETCH_LIMITS, sizeFitsPage } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE, IMPORT_CANCELLED } from "@/lib/shared/design/import/messages";
import { sketchRefusalMessage } from "@/lib/shared/design/import/refusal";
import { runWorkerJob } from "@/lib/shared/design/import/worker/run-worker-job";
import {
  SketchResponseSchema,
  type SketchRequest,
  type SketchResponse,
} from "@/lib/shared/design/import/worker/sketch-protocol";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import { logError } from "@/lib/shared/logger";
import { type Result, invalid } from "@/lib/shared/server-utils";

export type SketchResult = Extract<SketchResponse, { status: "result" }>;
export type SketchChoice = Extract<SketchResponse, { status: "choice" }>;
export type SketchJob = SketchResult | SketchChoice;
export type SketchJobRequest = Omit<SketchRequest, "id">;

const createWorker = (): Worker =>
  new Worker(new URL("./sketch.worker.ts", import.meta.url), { type: "module" });

const corrupt = (): Result<never> => invalid(DESIGN_IMPORT_MESSAGE.sketchCorrupt);

const checkResult = (response: SketchResult, request: SketchJobRequest): Result<object> => {
  if (response.layers.length === 0) return invalid(DESIGN_IMPORT_MESSAGE.noLayers);
  if (response.layers.length > request.capacityElements) {
    return invalid(DESIGN_IMPORT_MESSAGE.tooManyLayers(request.capacityElements));
  }
  if (!sizeFitsPage(response.width, response.height).ok) return corrupt();
  let total = request.usedBytes;
  for (const layer of response.layers) {
    const bytes = layer.pixelWidth * layer.pixelHeight * 4;
    if (layer.pixels.byteLength !== bytes || bytes > DESIGN_LIMITS.rasterBudgetBytes) {
      return corrupt();
    }
    total += rasterBytes(layer.pixelWidth, layer.pixelHeight);
    if (total > DESIGN_LIMITS.rasterBudgetBytes) return invalid(DESIGN_IMPORT_MESSAGE.memory);
  }
  return { ok: true };
};

const checkChoice = (response: SketchChoice, request: SketchJobRequest): Result<object> => {
  const unique = new Set(response.options.map((option) => option.id));
  return request.artboard === null && unique.size === response.options.length
    ? { ok: true }
    : corrupt();
};

export const checkSketchResponse = (
  response: SketchResponse,
  request: SketchJobRequest,
): Result<{ job: SketchJob }> => {
  if (response.status === "error") {
    return invalid(sketchRefusalMessage(response.refusal, response.args));
  }
  const checked =
    response.status === "result" ? checkResult(response, request) : checkChoice(response, request);
  return checked.ok ? { ok: true, job: response } : checked;
};

export const runSketchJob = (
  request: SketchJobRequest,
  signal: AbortSignal | undefined,
  timeoutMs: number = SKETCH_LIMITS.timeoutMs,
): Promise<Result<{ job: SketchJob }>> =>
  runWorkerJob<Result<{ job: SketchJob }>>({
    label: "sketch worker",
    create: createWorker,
    request: { id: 0, ...request },
    timeoutMs,
    signal,
    readFailed: () => invalid(DESIGN_IMPORT_MESSAGE.readFailed),
    timedOut: () => invalid(DESIGN_IMPORT_MESSAGE.timedOut),
    cancelled: () => IMPORT_CANCELLED,
    onMessage: (data, finish) => {
      const parsed = SketchResponseSchema.safeParse(data);
      if (!parsed.success) {
        logError("sketch worker response invalid", "ZodError");
        finish(invalid(DESIGN_IMPORT_MESSAGE.readFailed));
        return;
      }
      if (parsed.data.id !== 0) return;
      finish(checkSketchResponse(parsed.data, request));
    },
  });
