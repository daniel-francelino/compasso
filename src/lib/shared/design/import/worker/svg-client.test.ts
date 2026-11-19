import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const { encodeText } = await import("@/lib/shared/design/import/handlers/svg-fixtures");
const { decodeSvgVector } = await import("@/lib/shared/design/import/handlers/svg-import");
const { SvgFallback } = await import("@/lib/shared/design/import/handlers/svg-vector-types");
const { ICON } = await import("@/lib/shared/design/import/handlers/svg-vector-fixtures");
const { DESIGN_IMPORT_MESSAGE, IMPORT_CANCELLED } =
  await import("@/lib/shared/design/import/messages");
const { DesignImportFormat, DesignImportKind, DesignImportNoteKind } =
  await import("@/lib/shared/design/import/types");
const { runSvgVectorJob } = await import("@/lib/shared/design/import/worker/svg-client");
const { DESIGN_LIMITS, DesignPathFillRule, DesignPathPaintKind } =
  await import("@/lib/shared/design/types");
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

const lastWorker = (): FakeWorker => {
  const worker = FakeWorker.instances.at(-1);
  if (worker === undefined) throw new Error("no worker");
  return worker;
};

const PATH = "M0 0L10 0L10 10Z";

const color = (digits: string): string => `#${digits}`;

const shape = (overrides: Record<string, unknown> = {}) => ({
  name: null,
  d: PATH,
  commandCount: 4,
  fill: { kind: DesignPathPaintKind.Solid, color: color("ff0000") },
  stroke: null,
  fillRule: DesignPathFillRule.NonZero,
  opacity: 1,
  bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  ...overrides,
});

const good = (overrides: Record<string, unknown> = {}) => ({
  id: 0,
  status: "result",
  width: 100,
  height: 100,
  shapes: [shape()],
  dataBytes: PATH.length,
  ...overrides,
});

const bytes = () => encodeText(ICON);

const RASTER = {
  ok: true as const,
  kind: DesignImportKind.Image,
  design: {
    format: DesignImportFormat.Svg,
    width: 64,
    height: 64,
    elements: [],
    buffers: new Map(),
    notes: [{ kind: DesignImportNoteKind.VectorRasterized, count: 1 }],
    metadata: null,
  },
};

const start = async (signal?: AbortSignal, timeoutMs?: number) => {
  const job = runSvgVectorJob(bytes(), signal, timeoutMs);
  await vi.advanceTimersByTimeAsync(0);
  return { job, worker: lastWorker() };
};

const failureMessage = (outcome: { ok: boolean }): string | null =>
  !outcome.ok && "message" in outcome && typeof outcome.message === "string"
    ? outcome.message
    : null;

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

describe("runSvgVectorJob", () => {
  it("posts the bytes and returns the validated plain result, then terminates", async () => {
    const { job, worker } = await start();
    expect(worker.posted[0]).toMatchObject({ id: 0, bytes: expect.any(Uint8Array) });
    worker.emit(good());
    const outcome = await job;
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.shapes).toHaveLength(1);
    expect(worker.terminated).toBe(1);
  });

  it("terminates on the watchdog and reports the timeout reason", async () => {
    const { job, worker } = await start(undefined, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await job).toMatchObject({ ok: false, reason: SvgFallback.Timeout });
    expect(worker.terminated).toBe(1);
  });

  it("terminates on cancel", async () => {
    const controller = new AbortController();
    const { job, worker } = await start(controller.signal);
    controller.abort();
    expect(await job).toBe(IMPORT_CANCELLED);
    expect(worker.terminated).toBe(1);
  });

  it("never starts a worker on an aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await runSvgVectorJob(bytes(), controller.signal)).toBe(IMPORT_CANCELLED);
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("refuses with the generic message when Worker does not exist", async () => {
    vi.stubGlobal("Worker", undefined);
    const outcome = await runSvgVectorJob(bytes(), undefined);
    expect(failureMessage(outcome)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(outcome).not.toHaveProperty("reason");
  });

  it("uses the generic message on onerror and onmessageerror with a fixed label", async () => {
    const first = await start();
    first.worker.onerror?.(new Event("error"));
    expect(failureMessage(await first.job)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(logError).toHaveBeenCalledWith("svg worker failed", "error");
    const second = await start();
    second.worker.onmessageerror?.(new Event("messageerror"));
    expect(failureMessage(await second.job)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(logError).toHaveBeenCalledWith("svg worker message failed", "messageerror");
    expect(second.worker.terminated).toBe(1);
  });

  it("ignores a message with another id and keeps waiting", async () => {
    const { job, worker } = await start();
    worker.emit(good({ id: 7 }));
    expect(worker.terminated).toBe(0);
    worker.emit(good());
    expect((await job).ok).toBe(true);
  });

  it.each(Object.values(SvgFallback))(
    "maps the worker failure %s to its reason",
    async (reason) => {
      const { job, worker } = await start();
      worker.emit({ id: 0, status: "failure", reason });
      expect(await job).toMatchObject({ ok: false, reason });
    },
  );

  const stroke = {
    color: color("000000"),
    width: 1,
    cap: "x",
    join: "miter",
    miterLimit: 4,
    dashed: false,
  };
  const tooMany = Array.from({ length: DESIGN_LIMITS.maxElements + 1 }, () => shape());
  const nanBounds = { minX: Number.NaN, minY: 0, maxX: 1, maxY: 1 };
  const hostile: [string, unknown][] = [
    ["a non object", "nope"],
    ["an unknown status", { id: 0, status: "ok" }],
    ["an unknown reason", { id: 0, status: "failure", reason: "svg_new" }],
    ["an extra field", good({ extra: 1 })],
    ["an extra field in a shape", good({ shapes: [shape({ extra: 1 })] })],
    ["NaN width", good({ width: Number.NaN })],
    ["Infinity height", good({ height: Number.POSITIVE_INFINITY })],
    ["NaN bounds", good({ shapes: [shape({ bounds: nanBounds })] })],
    ["a side over the limit", good({ width: DESIGN_LIMITS.maxSize + 1 })],
    ["no shapes", good({ shapes: [], dataBytes: 1 })],
    ["too many shapes", good({ shapes: tooMany, dataBytes: 1 })],
    [
      "d over the cap",
      good({ shapes: [shape({ d: `M${"1".repeat(DESIGN_LIMITS.maxPathData)}` })] }),
    ],
    ["d with a bad character", good({ shapes: [shape({ d: "M0 0 <script>" })], dataBytes: 13 })],
    ["d that does not start with M", good({ shapes: [shape({ d: "L0 0" })], dataBytes: 4 })],
    ["a wrong fill rule", good({ shapes: [shape({ fillRule: "nonsense" })] })],
    ["a wrong paint kind", good({ shapes: [shape({ fill: { kind: "pattern" } })] })],
    ["a bad color", good({ shapes: [shape({ fill: { kind: "solid", color: "red" } })] })],
    ["a wrong stroke cap", good({ shapes: [shape({ stroke })] })],
    ["an opacity over 1", good({ shapes: [shape({ opacity: 2 })] })],
    ["a data total that lies", good({ dataBytes: 1 })],
    [
      "a data total over the import cap",
      good({ dataBytes: DESIGN_LIMITS.maxVectorImportBytes + 1 }),
    ],
  ];

  it.each(hostile)(
    "rejects %s with a fixed label and the generic message",
    async (_name, payload) => {
      const { job, worker } = await start();
      worker.emit(payload);
      const outcome = await job;
      expect(failureMessage(outcome)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
      expect(outcome).not.toHaveProperty("shapes");
      expect(logError).toHaveBeenCalledWith("svg worker response invalid", "ZodError");
      expect(worker.terminated).toBe(1);
    },
  );
});

describe("decodeSvgVector through the worker client", () => {
  let next = 0;
  const input = (signal?: AbortSignal) => ({
    file: new File([ICON], "Logo.svg"),
    bytes: bytes(),
    capacityElements: DESIGN_LIMITS.maxElements,
    usedBytes: 0,
    newId: () => `p${(next += 1)}`,
    ...(signal === undefined ? {} : { signal }),
  });
  const withClient = () => {
    const raster = vi.fn(async () => RASTER);
    const parse = (data: Uint8Array, signal: AbortSignal | undefined) =>
      runSvgVectorJob(data, signal, 1000);
    return { raster, deps: { parse, raster } };
  };

  it("refuses a watchdog timeout with svgVectorTimeout and never falls back", async () => {
    const { deps, raster } = withClient();
    const pending = decodeSvgVector(input(), deps);
    await vi.advanceTimersByTimeAsync(1000);
    expect(failureMessage(await pending)).toBe(DESIGN_IMPORT_MESSAGE.svgVectorTimeout);
    expect(raster).not.toHaveBeenCalled();
    expect(lastWorker().terminated).toBe(1);
  });

  it("refuses with the generic message and no fallback when Worker is missing", async () => {
    vi.stubGlobal("Worker", undefined);
    const { deps, raster } = withClient();
    expect(failureMessage(await decodeSvgVector(input(), deps))).toBe(
      DESIGN_IMPORT_MESSAGE.readFailed,
    );
    expect(raster).not.toHaveBeenCalled();
  });

  it("refuses a malformed response and places nothing", async () => {
    const { deps, raster } = withClient();
    const pending = decodeSvgVector(input(), deps);
    await vi.advanceTimersByTimeAsync(0);
    lastWorker().emit({ id: 0, status: "result", width: "x" });
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(failureMessage(result)).toBe(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(raster).not.toHaveBeenCalled();
  });

  it("returns the cancellation of an aborted signal without a fallback", async () => {
    const controller = new AbortController();
    const { deps, raster } = withClient();
    const pending = decodeSvgVector(input(controller.signal), deps);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    expect(await pending).toBe(IMPORT_CANCELLED);
    expect(raster).not.toHaveBeenCalled();
  });

  it("builds elements from a valid worker result", async () => {
    const { deps, raster } = withClient();
    const pending = decodeSvgVector(input(), deps);
    await vi.advanceTimersByTimeAsync(0);
    lastWorker().emit(good());
    const result = await pending;
    expect(result.ok && result.kind === DesignImportKind.Document).toBe(true);
    expect(raster).not.toHaveBeenCalled();
  });

  it("falls back to the raster handler on svg_internal_error and svg_unsupported", async () => {
    for (const reason of [SvgFallback.Internal, SvgFallback.Unsupported]) {
      const { deps, raster } = withClient();
      const pending = decodeSvgVector(input(), deps);
      await vi.advanceTimersByTimeAsync(0);
      lastWorker().emit({ id: 0, status: "failure", reason });
      expect(await pending).toBe(RASTER);
      expect(raster).toHaveBeenCalledTimes(1);
    }
  });
});
