import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const { SKETCH_LIMITS } = await import("@/lib/shared/design/import/limits");
const { DESIGN_IMPORT_MESSAGE } = await import("@/lib/shared/design/import/messages");
const { SketchRefusal } = await import("@/lib/shared/design/import/worker/sketch-protocol");
const { checkSketchResponse, runSketchJob } =
  await import("@/lib/shared/design/import/worker/sketch-client");
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

const request = (artboard: string | null = null, usedBytes = 0) => ({
  file: new File([new Uint8Array(8)], "private-name.sketch"),
  usedBytes,
  capacityElements: 200,
  artboard,
});

const layer = (overrides: Record<string, unknown> = {}) => ({
  name: "a",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  opacity: 1,
  hidden: false,
  isText: false,
  pixelWidth: 2,
  pixelHeight: 2,
  pixels: new ArrayBuffer(16),
  ...overrides,
});

const result = (layers: unknown[] = [layer()], overrides: Record<string, unknown> = {}) => ({
  id: 0,
  status: "result",
  width: 200,
  height: 100,
  layers,
  downscaled: false,
  styles: 0,
  unsupported: 0,
  deepGroups: 0,
  ...overrides,
});

const lastWorker = (): FakeWorker => {
  const worker = FakeWorker.instances.at(-1);
  if (worker === undefined) throw new Error("no worker");
  return worker;
};

const messageOf = async (job: ReturnType<typeof runSketchJob>): Promise<string | null> => {
  const outcome = await job;
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

describe("runSketchJob", () => {
  it("posts the File itself, resolves a good result and terminates the worker", async () => {
    const job = runSketchJob(request(), undefined);
    const worker = lastWorker();
    expect(worker.posted[0]).toMatchObject({ id: 0, file: expect.any(File), artboard: null });
    worker.emit(result());
    const outcome = await job;
    expect(outcome.ok && outcome.job.status).toBe("result");
    expect(worker.terminated).toBe(1);
  });

  it("times out, terminates and ignores a late result", async () => {
    const job = runSketchJob(request(), undefined);
    const worker = lastWorker();
    await vi.advanceTimersByTimeAsync(SKETCH_LIMITS.timeoutMs - 1);
    expect(worker.terminated).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(worker.terminated).toBe(1);
    expect(await messageOf(job)).toBe(DESIGN_IMPORT_MESSAGE.timedOut);
    worker.emit(result());
    expect(worker.terminated).toBe(1);
  });

  it("cancels on abort, terminates once and removes the listener", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const job = runSketchJob(request(), controller.signal);
    const worker = lastWorker();
    controller.abort();
    expect(await messageOf(job)).toBe(DESIGN_IMPORT_MESSAGE.cancelled);
    expect(worker.terminated).toBe(1);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(logError).not.toHaveBeenCalled();
  });

  it("never starts a worker on a pre-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await messageOf(runSketchJob(request(), controller.signal))).toBe(
      DESIGN_IMPORT_MESSAGE.cancelled,
    );
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("refuses a malformed response with the fixed label and the error name only", async () => {
    const job = runSketchJob(request(), undefined);
    const worker = lastWorker();
    worker.emit({ id: 0, status: "result", width: "wide" });
    expect(await messageOf(job)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(worker.terminated).toBe(1);
    expect(logError).toHaveBeenCalledWith("sketch worker response invalid", "ZodError");
  });

  it("ignores a response with another id and keeps waiting", async () => {
    const job = runSketchJob(request(), undefined);
    const worker = lastWorker();
    worker.emit(result([layer()], { id: 7 }));
    expect(worker.terminated).toBe(0);
    worker.emit(result());
    expect((await job).ok).toBe(true);
    expect(worker.terminated).toBe(1);
  });

  it("fails on worker errors without leaking details", async () => {
    const job = runSketchJob(request(), undefined);
    const worker = lastWorker();
    worker.onerror?.(new Event("error"));
    expect(await messageOf(job)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(logError).toHaveBeenCalledWith("sketch worker failed", "error");
  });

  it("fails cleanly when Worker is missing", async () => {
    vi.stubGlobal("Worker", undefined);
    expect(await messageOf(runSketchJob(request(), undefined))).toBe(
      DESIGN_IMPORT_MESSAGE.readFailed,
    );
  });
});

describe("checkSketchResponse", () => {
  const parse = (value: unknown) => {
    const response = value as Parameters<typeof checkSketchResponse>[0];
    return response;
  };

  it("refuses pixels whose byteLength is not width times height times 4", () => {
    const bad = parse(result([layer({ pixels: new ArrayBuffer(15) })]));
    const checked = checkSketchResponse(bad, request());
    expect(checked.ok ? null : checked.message).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
  });

  it("refuses a page outside the limits and more layers than the capacity", () => {
    const small = checkSketchResponse(
      parse(result([layer()], { width: 10, height: 10 })),
      request(),
    );
    expect(small.ok).toBe(false);
    const many = Array.from({ length: 3 }, () => layer());
    const over = checkSketchResponse(parse(result(many)), { ...request(), capacityElements: 2 });
    expect(over.ok ? null : over.message).toBe(DESIGN_IMPORT_MESSAGE.tooManyLayers(2));
  });

  it("refuses when the layers do not fit the remaining raster budget", () => {
    const checked = checkSketchResponse(parse(result()), request(null, 512 * 1024 * 1024));
    expect(checked.ok ? null : checked.message).toBe(DESIGN_IMPORT_MESSAGE.memory);
  });

  it("maps a refusal to its message and refuses a choice when an artboard was asked", () => {
    const refused = checkSketchResponse(
      { id: 0, status: "error", refusal: SketchRefusal.TooManyLayers, args: [5] },
      request(),
    );
    expect(refused.ok ? null : refused.message).toBe(DESIGN_IMPORT_MESSAGE.tooManyLayers(5));
    const options = [
      { id: "0:0", name: "A", width: 100, height: 100 },
      { id: "0:1", name: "B", width: 100, height: 100 },
    ];
    expect(checkSketchResponse({ id: 0, status: "choice", options }, request()).ok).toBe(true);
    expect(checkSketchResponse({ id: 0, status: "choice", options }, request("0:1")).ok).toBe(
      false,
    );
  });
});
