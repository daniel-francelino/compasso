import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const { DESIGN_IMPORT_LIMITS } = await import("@/lib/shared/design/import/limits");
const { DESIGN_IMPORT_MESSAGE } = await import("@/lib/shared/design/import/messages");
const { DesignImportFailure, DesignImportFormat } =
  await import("@/lib/shared/design/import/types");
const { WorkerStatus } = await import("@/lib/shared/design/import/worker/protocol");
const { documentOf, layerNode, square } =
  await import("@/lib/shared/design/import/worker/test-fixtures");
const { ImportCancelledError, startImportJob } =
  await import("@/lib/shared/design/import/worker/worker-client");
const { logError } = await import("@/lib/shared/logger");

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: Event) => void) | null = null;
  terminated = 0;
  posted: unknown[] = [];
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated += 1;
  }
  emit(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }
}

const input = () => ({
  file: new File([new Uint8Array(8)], "private-name.psd"),
  format: DesignImportFormat.Psd,
  limits: { capacityElements: 200, usedBytes: 0 },
});

const goodDocument = () => documentOf([layerNode("A", square(0, 0, 8))], 64);

const lastWorker = (): FakeWorker => {
  const worker = FakeWorker.instances.at(-1);
  if (worker === undefined) throw new Error("no worker");
  return worker;
};

const requestId = (worker: FakeWorker): number => {
  const first = worker.posted[0];
  return typeof first === "object" &&
    first !== null &&
    "id" in first &&
    typeof first.id === "number"
    ? first.id
    : -1;
};

const message = async (job: ReturnType<typeof startImportJob>): Promise<string | null> => {
  const outcome = await job.result;
  return outcome.ok ? null : outcome.message;
};

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.useFakeTimers();
  vi.mocked(logError).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("startImportJob", () => {
  it("passes the File itself, resolves a good conversation and terminates the worker", async () => {
    const onProgress = vi.fn();
    const job = startImportJob(input(), { onProgress });
    await vi.advanceTimersByTimeAsync(0);
    const worker = lastWorker();
    const sent = worker.posted[0];
    expect(sent).toMatchObject({ file: expect.any(File) });
    const id = requestId(worker);
    worker.emit({ id, status: WorkerStatus.Progress, done: 1, total: 1 });
    worker.emit({ id, status: WorkerStatus.Result, document: goodDocument() });
    const outcome = await job.result;
    expect(outcome.ok).toBe(true);
    expect(onProgress).toHaveBeenCalledWith(1, 1);
    expect(worker.terminated).toBe(1);
  });

  it("removes its abort listener when the job ends and never starts on an aborted signal", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const job = startImportJob(input(), { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    const worker = lastWorker();
    worker.emit({
      id: requestId(worker),
      status: WorkerStatus.Result,
      document: goodDocument(),
    });
    await job.result;
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    const before = FakeWorker.instances.length;
    const aborted = new AbortController();
    aborted.abort();
    const late = startImportJob(input(), { signal: aborted.signal });
    await expect(late.result).rejects.toBeInstanceOf(ImportCancelledError);
    expect(FakeWorker.instances).toHaveLength(before);
  });

  it("times out at workerTimeoutMs and ignores a late result", async () => {
    const job = startImportJob(input());
    await vi.advanceTimersByTimeAsync(0);
    const worker = lastWorker();
    const id = requestId(worker);
    await vi.advanceTimersByTimeAsync(DESIGN_IMPORT_LIMITS.workerTimeoutMs - 1);
    expect(worker.terminated).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(worker.terminated).toBe(1);
    expect(await message(job)).toBe(DESIGN_IMPORT_MESSAGE.timedOut);
    worker.emit({ id, status: WorkerStatus.Result, document: goodDocument() });
    expect(worker.terminated).toBe(1);
  });

  it("cancel terminates and rejects with the marker, without logging; later calls do nothing", async () => {
    const job = startImportJob(input());
    await vi.advanceTimersByTimeAsync(0);
    const worker = lastWorker();
    const id = requestId(worker);
    const rejected = expect(job.result).rejects.toBeInstanceOf(ImportCancelledError);
    job.cancel();
    job.cancel();
    await rejected;
    expect(worker.terminated).toBe(1);
    expect(logError).not.toHaveBeenCalled();
    worker.emit({ id, status: WorkerStatus.Result, document: goodDocument() });
    expect(worker.terminated).toBe(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it("cancel after the result was delivered is a no-op", async () => {
    const job = startImportJob(input());
    await vi.advanceTimersByTimeAsync(0);
    const worker = lastWorker();
    worker.emit({ id: requestId(worker), status: WorkerStatus.Result, document: goodDocument() });
    expect((await job.result).ok).toBe(true);
    job.cancel();
    expect(worker.terminated).toBe(1);
  });

  it("cancels through an abort signal, also when already aborted", async () => {
    const controller = new AbortController();
    const job = startImportJob(input(), { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    const rejected = expect(job.result).rejects.toBeInstanceOf(ImportCancelledError);
    controller.abort();
    await rejected;
    expect(lastWorker().terminated).toBe(1);
    const aborted = startImportJob(input(), { signal: controller.signal });
    await expect(aborted.result).rejects.toBeInstanceOf(ImportCancelledError);
  });

  it("maps onerror and onmessageerror to the generic message and logs only a fixed label", async () => {
    for (const channel of ["onerror", "onmessageerror"] as const) {
      const job = startImportJob(input());
      await vi.advanceTimersByTimeAsync(0);
      const worker = lastWorker();
      worker[channel]?.(
        Object.assign(new Event("error"), {
          message: "private-name leaked in message",
          filename: "https://x.test/private-name.psd",
        }),
      );
      expect(await message(job)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
      expect(worker.terminated).toBe(1);
    }
    const calls = JSON.stringify(vi.mocked(logError).mock.calls);
    expect(calls).not.toContain("private-name");
    expect(calls).not.toContain("leaked");
    expect(vi.mocked(logError)).toHaveBeenCalledTimes(2);
  });

  it("refuses without a Worker and never starts a decode on the main thread", async () => {
    vi.stubGlobal("Worker", undefined);
    const job = startImportJob(input());
    expect(await message(job)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("runs one decode at a time", async () => {
    const first = startImportJob(input());
    const second = startImportJob(input());
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeWorker.instances).toHaveLength(1);
    const worker = lastWorker();
    worker.emit({ id: requestId(worker), status: WorkerStatus.Result, document: goodDocument() });
    await first.result;
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeWorker.instances).toHaveLength(2);
    second.cancel();
    await expect(second.result).rejects.toBeInstanceOf(ImportCancelledError);
  });

  it("ignores another request id and rejects malformed or lying responses", async () => {
    const job = startImportJob(input());
    await vi.advanceTimersByTimeAsync(0);
    const worker = lastWorker();
    const id = requestId(worker);
    worker.emit({ id: id + 99, status: WorkerStatus.Result, document: goodDocument() });
    expect(worker.terminated).toBe(0);
    const lying = layerNode("A", square(0, 0, 8), { pixels: new ArrayBuffer(3) });
    worker.emit({ id, status: WorkerStatus.Result, document: documentOf([lying], 64) });
    expect(await message(job)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(worker.terminated).toBe(1);
    const next = startImportJob(input());
    await vi.advanceTimersByTimeAsync(0);
    lastWorker().emit({ nonsense: true });
    expect(await message(next)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
  });

  it("maps a worker error response to its message and drops partial output", async () => {
    const job = startImportJob(input());
    await vi.advanceTimersByTimeAsync(0);
    const worker = lastWorker();
    const id = requestId(worker);
    worker.emit({ id, status: WorkerStatus.Progress, done: 1, total: 3 });
    worker.emit({ id, status: WorkerStatus.Progress, done: 2, total: 3 });
    worker.emit({ id, status: WorkerStatus.Error, failure: DesignImportFailure.LayerTooLarge });
    const outcome = await job.result;
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.message).toBe(DESIGN_IMPORT_MESSAGE.layerTooLarge);
    expect(worker.terminated).toBe(1);
  });
});
