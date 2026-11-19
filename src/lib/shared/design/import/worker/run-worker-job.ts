import { errorName } from "@/lib/shared/design/import/run-limits";
import { logError } from "@/lib/shared/logger";

export type WorkerJobSpec<Outcome> = {
  label: string;
  create: () => Worker;
  request: unknown;
  timeoutMs: number;
  signal?: AbortSignal | undefined;
  readFailed: () => Outcome;
  timedOut: () => Outcome;
  cancelled: () => Outcome;
  onMessage: (data: unknown, finish: (outcome: Outcome) => void) => void;
  bindCancel?: (cancel: () => void) => void;
};

export const runWorkerJob = <Outcome>(spec: WorkerJobSpec<Outcome>): Promise<Outcome> =>
  new Promise<Outcome>((resolve, reject) => {
    const settle = (compute: () => Outcome): void => {
      try {
        resolve(compute());
      } catch (error) {
        reject(error);
      }
    };
    if (spec.signal?.aborted === true) {
      settle(spec.cancelled);
      return;
    }
    if (typeof Worker === "undefined") {
      settle(spec.readFailed);
      return;
    }
    let worker: Worker;
    try {
      worker = spec.create();
    } catch (error) {
      logError(`${spec.label} start failed`, errorName(error));
      settle(spec.readFailed);
      return;
    }
    let settled = false;
    const finishWith = (compute: () => Outcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      spec.signal?.removeEventListener("abort", cancel);
      worker.terminate();
      settle(compute);
    };
    const cancel = (): void => finishWith(spec.cancelled);
    const timer = setTimeout(() => finishWith(spec.timedOut), spec.timeoutMs);
    spec.signal?.addEventListener("abort", cancel, { once: true });
    spec.bindCancel?.(cancel);
    const fail = (name: string, event: Event): void => {
      logError(`${spec.label} ${name}`, event.type);
      finishWith(spec.readFailed);
    };
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (settled) return;
      spec.onMessage(event.data, (outcome) => finishWith(() => outcome));
    };
    worker.onerror = (event) => fail("failed", event);
    worker.onmessageerror = (event) => fail("message failed", event);
    try {
      worker.postMessage(spec.request);
    } catch (error) {
      logError(`${spec.label} post failed`, errorName(error));
      finishWith(spec.readFailed);
    }
  });
