import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const { DESIGN_IMPORT_LIMITS } = await import("@/lib/shared/design/import/limits");
const { DESIGN_IMPORT_MESSAGE } = await import("@/lib/shared/design/import/messages");
const { DesignImportFormat } = await import("@/lib/shared/design/import/types");
const { WorkerStatus } = await import("@/lib/shared/design/import/worker/protocol");
const { documentOf, layerNode, square } =
  await import("@/lib/shared/design/import/worker/test-fixtures");
const { ImportCancelledError, startImportJob: startJob } =
  await import("@/lib/shared/design/import/worker/worker-client");

const jobs: ReturnType<typeof startJob>[] = [];

const startImportJob: typeof startJob = (...args) => {
  const job = startJob(...args);
  jobs.push(job);
  return job;
};
const { logError } = await import("@/lib/shared/logger");

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: Event) => void) | null = null;
  terminated = 0;
  posted: unknown[][] = [];
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(...args: unknown[]) {
    this.posted.push(args);
  }
  terminate() {
    this.terminated += 1;
  }
  emit(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }
}

const SECRET = "client-secret";

const input = () => ({
  file: new File([new Uint8Array(8)], `${SECRET}.psd`),
  format: DesignImportFormat.Psd,
  limits: { capacityElements: 200, usedBytes: 0 },
});

const good = () => documentOf([layerNode("A", square(0, 0, 8))], 64);

const started = async () => {
  const job = startImportJob(input());
  await vi.advanceTimersByTimeAsync(0);
  const worker = FakeWorker.instances.at(-1);
  if (worker === undefined) throw new Error("no worker");
  const first = worker.posted[0]?.[0];
  const id = typeof first === "object" && first !== null && "id" in first ? Number(first.id) : -1;
  return { job, worker, id, request: first };
};

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.useFakeTimers();
  vi.mocked(logError).mockClear();
});

afterEach(async () => {
  for (const job of jobs.splice(0)) {
    job.result.catch(() => undefined);
    job.cancel();
  }
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("worker client hostile cases", () => {
  it("posts the request alone: no transfer list and no copied buffer", async () => {
    const { worker, request } = await started();
    expect(worker.posted[0]).toHaveLength(1);
    expect(request).toMatchObject({ file: expect.any(File) });
    expect(Object.keys(request as object).sort()).toEqual(["file", "format", "id", "limits"]);
  });

  it("cancels after a progress message and drops the late result", async () => {
    const { job, worker, id } = await started();
    const rejected = expect(job.result).rejects.toBeInstanceOf(ImportCancelledError);
    worker.emit({ id, status: WorkerStatus.Progress, done: 1, total: 2 });
    job.cancel();
    await rejected;
    worker.emit({ id, status: WorkerStatus.Result, document: good() });
    expect(worker.terminated).toBe(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("cancel of a queued job never creates its worker", async () => {
    const first = startImportJob(input());
    const second = startImportJob(input());
    second.cancel();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeWorker.instances).toHaveLength(1);
    first.cancel();
    await expect(first.result).rejects.toBeInstanceOf(ImportCancelledError);
    await expect(second.result).rejects.toBeInstanceOf(ImportCancelledError);
    await vi.advanceTimersByTimeAsync(DESIGN_IMPORT_LIMITS.workerTimeoutMs);
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("ignores an error response that carries another request id", async () => {
    const { job, worker, id } = await started();
    worker.emit({ id: id + 1, status: WorkerStatus.Error, failure: "memory" });
    expect(worker.terminated).toBe(0);
    worker.emit({ id, status: WorkerStatus.Result, document: good() });
    expect((await job.result).ok).toBe(true);
  });

  it("times out, returns the timed-out message, ignores the late result and does not log", async () => {
    const { job, worker, id } = await started();
    await vi.advanceTimersByTimeAsync(DESIGN_IMPORT_LIMITS.workerTimeoutMs);
    const outcome = await job.result;
    expect(!outcome.ok && outcome.message).toBe(DESIGN_IMPORT_MESSAGE.timedOut);
    worker.emit({ id, status: WorkerStatus.Result, document: good() });
    expect(worker.terminated).toBe(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("logs only fixed strings for an invalid response, never file name or payload", async () => {
    const { job, worker } = await started();
    worker.emit({ secret: SECRET, pixels: new ArrayBuffer(4) });
    await job.result;
    const calls = vi.mocked(logError).mock.calls;
    expect(JSON.stringify(calls)).not.toContain(SECRET);
    expect(calls.every((call) => call.every((arg) => typeof arg === "string"))).toBe(true);
  });

  it("maps a throwing Worker constructor to the generic message without logging the error text", async () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error(`blocked ${SECRET}`);
        }
      },
    );
    const outcome = await startImportJob(input()).result;
    expect(!outcome.ok && outcome.message).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(JSON.stringify(vi.mocked(logError).mock.calls)).not.toContain(SECRET);
  });

  it("never logs the message or filename carried by an error event", async () => {
    for (const channel of ["onerror", "onmessageerror"] as const) {
      const { job, worker } = await started();
      worker[channel]?.(
        Object.assign(new Event("error"), {
          message: `boom ${SECRET}`,
          filename: `https://x.test/${SECRET}.js`,
          error: new Error(SECRET),
        }),
      );
      const outcome = await job.result;
      expect(!outcome.ok && outcome.message).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    }
    expect(JSON.stringify(vi.mocked(logError).mock.calls)).not.toContain(SECRET);
    expect(vi.mocked(logError)).toHaveBeenCalledTimes(2);
  });
});
