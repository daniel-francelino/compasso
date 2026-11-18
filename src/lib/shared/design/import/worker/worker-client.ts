import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { DesignImportFailure, type DesignImportFormat } from "@/lib/shared/design/import/types";
import {
  type WorkerDocument,
  type WorkerLimits,
  type WorkerRequest,
  WorkerResponseSchema,
  WorkerStatus,
} from "@/lib/shared/design/import/worker/protocol";
import { validateWorkerDocument } from "@/lib/shared/design/import/worker/validate-document";
import { errorName } from "@/lib/shared/design/import/run-limits";
import { logError } from "@/lib/shared/logger";
import { type Result, invalid } from "@/lib/shared/server-utils";

export class ImportCancelledError extends Error {
  constructor() {
    super("import-cancelled");
    this.name = "ImportCancelledError";
  }
}

export type WorkerOutcome = Result<{ document: WorkerDocument }>;

export type ImportJobOptions = {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal | undefined;
};

export type ImportJob = { result: Promise<WorkerOutcome>; cancel: () => void };

type JobInput = { file: File; format: DesignImportFormat; limits: WorkerLimits };

const failureMessage = (failure: DesignImportFailure, limits: WorkerLimits): string => {
  switch (failure) {
    case DesignImportFailure.Memory:
      return DESIGN_IMPORT_MESSAGE.memory;
    case DesignImportFailure.TooManyLayers:
      return DESIGN_IMPORT_MESSAGE.tooManyLayers(limits.capacityElements);
    case DesignImportFailure.LayerTooLarge:
      return DESIGN_IMPORT_MESSAGE.layerTooLarge;
    case DesignImportFailure.NoLayers:
      return DESIGN_IMPORT_MESSAGE.noLayers;
    case DesignImportFailure.Corrupt:
      return DESIGN_IMPORT_MESSAGE.corrupt;
  }
};

const createWorker = (): Worker =>
  new Worker(new URL("./import.worker.ts", import.meta.url), { type: "module" });

const runOnce = (
  request: WorkerRequest,
  options: ImportJobOptions,
  bindCancel: (cancel: () => void) => void,
): Promise<WorkerOutcome> =>
  new Promise<WorkerOutcome>((resolve, reject) => {
    if (typeof Worker === "undefined") {
      resolve(invalid(DESIGN_IMPORT_MESSAGE.readFailed));
      return;
    }
    let worker: Worker;
    try {
      worker = createWorker();
    } catch (error) {
      logError("import worker start failed", errorName(error));
      resolve(invalid(DESIGN_IMPORT_MESSAGE.readFailed));
      return;
    }
    let settled = false;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      settle();
    };
    const timer = setTimeout(
      () => finish(() => resolve(invalid(DESIGN_IMPORT_MESSAGE.timedOut))),
      DESIGN_IMPORT_LIMITS.workerTimeoutMs,
    );
    const failGeneric = (label: string, event: Event) => {
      logError(label, event.type);
      finish(() => resolve(invalid(DESIGN_IMPORT_MESSAGE.readFailed)));
    };
    bindCancel(() => finish(() => reject(new ImportCancelledError())));
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (settled) return;
      const parsed = WorkerResponseSchema.safeParse(event.data);
      if (!parsed.success) {
        logError("import worker response invalid", "ZodError");
        finish(() => resolve(invalid(DESIGN_IMPORT_MESSAGE.readFailed)));
        return;
      }
      const response = parsed.data;
      if (response.id !== request.id) return;
      if (response.status === WorkerStatus.Progress) {
        options.onProgress?.(response.done, response.total);
        return;
      }
      const outcome =
        response.status === WorkerStatus.Error
          ? invalid(failureMessage(response.failure, request.limits))
          : validateWorkerDocument(response.document, request.limits);
      finish(() => resolve(outcome));
    };
    worker.onerror = (event) => failGeneric("import worker failed", event);
    worker.onmessageerror = (event) => failGeneric("import worker message failed", event);
    worker.postMessage(request);
  });

let queue: Promise<unknown> = Promise.resolve();
let nextId = 0;

export const startImportJob = (input: JobInput, options: ImportJobOptions = {}): ImportJob => {
  nextId += 1;
  const request: WorkerRequest = { id: nextId, ...input };
  let cancelled = false;
  let cancelRunning: () => void = () => undefined;
  const cancel = () => {
    cancelled = true;
    cancelRunning();
  };
  const result = queue.then(() =>
    cancelled
      ? Promise.reject(new ImportCancelledError())
      : runOnce(request, options, (stop) => {
          cancelRunning = stop;
        }),
  );
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  const { signal } = options;
  if (signal?.aborted === true) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const detach = (): void => signal?.removeEventListener("abort", cancel);
  result.then(detach, detach);
  return { result, cancel };
};
