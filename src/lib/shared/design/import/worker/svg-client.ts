import { SvgFallback, svgFailure } from "@/lib/shared/design/import/handlers/svg-vector-types";
import type { SvgVectorResult } from "@/lib/shared/design/import/handlers/svg-vector-types";
import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE, IMPORT_CANCELLED } from "@/lib/shared/design/import/messages";
import { runWorkerJob } from "@/lib/shared/design/import/worker/run-worker-job";
import { SvgResponseSchema } from "@/lib/shared/design/import/worker/svg-protocol";
import { logError } from "@/lib/shared/logger";
import { type Failure, invalid } from "@/lib/shared/server-utils";

export type SvgJobOutcome = SvgVectorResult | Failure;

const createWorker = (): Worker =>
  new Worker(new URL("./svg.worker.ts", import.meta.url), { type: "module" });

export const runSvgVectorJob = (
  bytes: Uint8Array,
  signal: AbortSignal | undefined,
  timeoutMs: number = DESIGN_IMPORT_LIMITS.workerTimeoutMs,
): Promise<SvgJobOutcome> =>
  runWorkerJob<SvgJobOutcome>({
    label: "svg worker",
    create: createWorker,
    request: { id: 0, bytes },
    timeoutMs,
    signal,
    readFailed: () => invalid(DESIGN_IMPORT_MESSAGE.readFailed),
    timedOut: () => svgFailure(SvgFallback.Timeout),
    cancelled: () => IMPORT_CANCELLED,
    onMessage: (data, finish) => {
      const parsed = SvgResponseSchema.safeParse(data);
      if (!parsed.success) {
        logError("svg worker response invalid", "ZodError");
        finish(invalid(DESIGN_IMPORT_MESSAGE.readFailed));
        return;
      }
      const response = parsed.data;
      if (response.id !== 0) return;
      finish(
        response.status === "failure"
          ? svgFailure(response.reason)
          : {
              ok: true,
              width: response.width,
              height: response.height,
              shapes: response.shapes,
              dataBytes: response.dataBytes,
            },
      );
    },
  });
