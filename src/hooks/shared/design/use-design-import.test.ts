import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  loading: vi.fn((..._args: unknown[]) => "t1"),
  success: vi.fn((..._args: unknown[]) => "t2"),
  error: vi.fn((..._args: unknown[]) => "t3"),
  dismiss: vi.fn((..._args: unknown[]) => undefined),
}));
const pick = vi.hoisted(() => vi.fn());
const read = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/shared/design/browser", () => ({ pickFile: pick }));
vi.mock("@/lib/shared/design/import/read-file", () => ({ readDesignFile: read }));
const logErrorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/shared/logger", () => ({ logError: logErrorMock }));
vi.mock("@/lib/shared/design/design.functions", () => ({ recordDesignImport: vi.fn() }));
vi.mock("@/hooks/shared/design/use-raster-store", () => ({ RASTER_MEMORY_MESSAGE: "memory" }));

const { createImportRun } = await import("@/hooks/shared/design/use-design-import");
const { DESIGN_IMPORT_MESSAGE, IMPORT_CANCELLED, IMPORT_UPLOAD_REASON } =
  await import("@/lib/shared/design/import/messages");
const { DESIGN_IMPORT_ACCEPT } = await import("@/lib/shared/design/import/registry");
const { DesignImportFormat, DesignImportKind, DesignImportNoteKind } =
  await import("@/lib/shared/design/import/types");
const { buildMetadata, withoutText } = await import("@/lib/shared/design/import/metadata");
const { DesignImportColorMode } = await import("@/lib/shared/design/import/types");
const { invalid } = await import("@/lib/shared/server-utils");
const { DESIGN_LIMITS } = await import("@/lib/shared/design/types");

const design = {
  format: DesignImportFormat.Png,
  width: 10,
  height: 10,
  elements: [],
  buffers: new Map(),
  notes: [],
  metadata: null,
};

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const metadata = (() => {
  const built = buildMetadata({
    source: {
      format: DesignImportFormat.Psd,
      colorMode: DesignImportColorMode.Rgb,
      bitsPerChannel: 8,
      pageCount: null,
    },
    dimensions: { sourceWidth: 10, sourceHeight: 10, pageWidth: 10, pageHeight: 10 },
  });
  if (built === null) throw new Error("metadata expected");
  return {
    ...built,
    textRuns: [{ layerIndex: 0, text: "x", fontName: null, fontSize: null, color: null }],
  };
})();

const setup = (existing = 0, allowed = true) => {
  const placer = {
    document: vi.fn((..._args: unknown[]) => ({ ok: true as const, notes: [], metadata: null })),
    image: vi.fn((..._args: unknown[]) => ({
      ok: true as const,
      notes: [{ kind: DesignImportNoteKind.Downscaled, count: 1 }],
      metadata: null,
    })),
  };
  const onBusy = vi.fn();
  const record = vi.fn((..._args: unknown[]) => Promise.resolve({ ok: true as const }));
  const run = createImportRun({
    newId: () => "id",
    existingElements: () => existing,
    usedBytes: () => 123,
    placer: () => placer,
    allowed: () => allowed,
    onBusy,
    record: (value) => record(value),
  });
  const unmount = run.mount();
  return { run, placer, onBusy, unmount, record };
};

beforeEach(() => {
  vi.clearAllMocks();
  pick.mockResolvedValue(new File([new Uint8Array(4)], "a.png"));
});

describe("createImportRun", () => {
  it("passes the registry accept list, capacity, used bytes and a signal", async () => {
    read.mockResolvedValue({ ok: true, kind: DesignImportKind.Image, design });
    const { run } = setup(150);
    await run.open();
    expect(pick).toHaveBeenCalledWith(DESIGN_IMPORT_ACCEPT);
    expect(read).toHaveBeenCalledWith(
      expect.any(File),
      expect.any(Function),
      expect.objectContaining({
        capacityElements: DESIGN_LIMITS.maxElements - 150,
        usedBytes: 123,
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("delegates by kind and shows the success toast with the note sentences", async () => {
    read.mockResolvedValue({ ok: true, kind: DesignImportKind.Image, design });
    const { run, placer, onBusy } = setup();
    await run.open();
    expect(placer.image).toHaveBeenCalledWith(design);
    expect(placer.document).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith("PNG importado.", {
      description: "Imagem reduzida para caber na página (1).",
    });
    expect(toastMock.dismiss).toHaveBeenCalledWith("t1");
    expect(onBusy.mock.calls).toEqual([[true], [false]]);

    read.mockResolvedValue({ ok: true, kind: DesignImportKind.Document, design });
    await run.open();
    expect(placer.document).toHaveBeenCalledWith(design);
  });

  it("hands the placer the design with its metadata unchanged, whatever the format", async () => {
    const metadata = { version: 1 };
    const withMetadata = { ...design, format: DesignImportFormat.Psd, metadata };
    read.mockResolvedValue({ ok: true, kind: DesignImportKind.Document, design: withMetadata });
    const { run, placer } = setup();
    await run.open();
    expect(placer.document).toHaveBeenCalledWith(withMetadata);
    const [handed] = placer.document.mock.calls[0] ?? [];
    expect(handed).toBe(withMetadata);
  });

  it("shows the loading toast with a cancel action", async () => {
    read.mockResolvedValue({ ok: true, kind: DesignImportKind.Image, design });
    const { run } = setup();
    await run.open();
    expect(toastMock.loading).toHaveBeenCalledWith("Importando arquivo…", {
      action: { label: "Cancelar importação", onClick: expect.any(Function) },
    });
  });

  it("ignores a second trigger while the first is pending", async () => {
    const gate = deferred<unknown>();
    read.mockReturnValue(gate.promise);
    const { run } = setup();
    const first = run.open();
    await run.open();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    expect(pick).toHaveBeenCalledTimes(1);
    gate.resolve({ ok: true, kind: DesignImportKind.Image, design });
    await first;
    expect(run.isRunning()).toBe(false);
  });

  it("is silent when the result is the cancelled marker", async () => {
    const gate = deferred<unknown>();
    read.mockReturnValue(gate.promise);
    const { run, placer, onBusy } = setup();
    const pending = run.open();
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    run.cancel();
    gate.resolve(IMPORT_CANCELLED);
    await pending;
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(placer.image).not.toHaveBeenCalled();
    expect(toastMock.dismiss).toHaveBeenCalledWith("t1");
    expect(onBusy).toHaveBeenLastCalledWith(false);
  });

  it("is silent for the cancelled marker even when cancel() was never called", async () => {
    read.mockResolvedValue(IMPORT_CANCELLED);
    const { run, placer, onBusy } = setup();
    await run.open();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(placer.image).not.toHaveBeenCalled();
    expect(onBusy).toHaveBeenLastCalledWith(false);
  });

  it("treats a different object with the cancelled text as an ordinary failure (identity contract)", async () => {
    read.mockResolvedValue(invalid(DESIGN_IMPORT_MESSAGE.cancelled));
    const { run } = setup();
    await run.open();
    expect(toastMock.error).toHaveBeenCalledTimes(1);
  });

  it("does not place a result that arrives after cancel", async () => {
    const gate = deferred<unknown>();
    read.mockReturnValue(gate.promise);
    const { run, placer } = setup();
    const pending = run.open();
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    run.cancel();
    gate.resolve({ ok: true, kind: DesignImportKind.Image, design });
    await pending;
    expect(placer.image).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("ignores a result that arrives after unmount and aborts the read", async () => {
    const gate = deferred<unknown>();
    read.mockReturnValue(gate.promise);
    const { run, placer, onBusy, unmount } = setup();
    const pending = run.open();
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    const signal = (read.mock.calls[0]?.[2] as { signal: AbortSignal }).signal;
    unmount();
    expect(signal.aborted).toBe(true);
    gate.resolve({ ok: true, kind: DesignImportKind.Image, design });
    await pending;
    expect(placer.image).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(onBusy.mock.calls).toEqual([[true]]);
  });

  it("shows a refusal and a placement failure as errors", async () => {
    read.mockResolvedValue(invalid(DESIGN_IMPORT_MESSAGE.corrupt));
    const { run, placer } = setup();
    await run.open();
    expect(toastMock.error).toHaveBeenCalledWith(DESIGN_IMPORT_MESSAGE.corrupt);

    placer.image.mockReturnValue(invalid("memory") as never);
    read.mockResolvedValue({ ok: true, kind: DesignImportKind.Image, design });
    await run.open();
    expect(toastMock.error).toHaveBeenLastCalledWith("memory");
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("does nothing when the picker is dismissed", async () => {
    pick.mockResolvedValue(null);
    const { run, onBusy } = setup();
    await run.open();
    expect(read).not.toHaveBeenCalled();
    expect(toastMock.loading).not.toHaveBeenCalled();
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
  });

  it("reports a flow failure and frees the guard", async () => {
    read.mockRejectedValue(new Error("boom"));
    const { run } = setup();
    await run.open();
    expect(toastMock.error).toHaveBeenCalledWith(DESIGN_IMPORT_MESSAGE.readFailed);
    expect(run.isRunning()).toBe(false);
  });
});

describe("permission", () => {
  it("does not open the picker without permission", async () => {
    const { run, onBusy } = setup(0, false);
    await run.open();
    expect(pick).not.toHaveBeenCalled();
    expect(onBusy).not.toHaveBeenCalled();
    expect(run.isRunning()).toBe(false);
  });

  it("has a reason text for a user without upload permission", () => {
    expect(IMPORT_UPLOAD_REASON).toContain("permissão");
  });

  describe("metadata record", () => {
    const placeWith = (value: unknown) => ({ ok: true as const, notes: [], metadata: value });

    it("records the metadata of a placed design without text runs and with consistent truncation", async () => {
      read.mockResolvedValue({ ok: true, kind: DesignImportKind.Document, design });
      const { run, placer, record } = setup();
      placer.document.mockReturnValue(placeWith(metadata) as never);
      await run.open();
      expect(record).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith(withoutText(metadata));
      expect(toastMock.error).not.toHaveBeenCalled();
    });

    it("skips the call when the metadata is null", async () => {
      read.mockResolvedValue({ ok: true, kind: DesignImportKind.Image, design });
      const { run, record } = setup();
      await run.open();
      expect(record).not.toHaveBeenCalled();
    });

    it("skips the call when the placement is refused", async () => {
      read.mockResolvedValue({ ok: true, kind: DesignImportKind.Image, design });
      const { run, placer, record } = setup();
      placer.image.mockReturnValue(invalid("memory") as never);
      await run.open();
      expect(record).not.toHaveBeenCalled();
    });

    it("keeps the import and shows the registered toast when the save fails", async () => {
      read.mockResolvedValue({ ok: true, kind: DesignImportKind.Document, design });
      const { run, placer, record } = setup();
      placer.document.mockReturnValue(placeWith(metadata) as never);
      record.mockResolvedValue(invalid("server detail secret") as never);
      await run.open();
      await Promise.resolve();
      expect(toastMock.success).toHaveBeenCalledTimes(1);
      expect(toastMock.error).toHaveBeenCalledWith(DESIGN_IMPORT_MESSAGE.metadataNotSaved);
      expect(logErrorMock).toHaveBeenCalledWith("import metadata not saved", expect.any(String));
      expect(JSON.stringify(logErrorMock.mock.calls)).not.toContain("secret");
    });

    it("treats a rejected call like a failure and never throws", async () => {
      read.mockResolvedValue({ ok: true, kind: DesignImportKind.Document, design });
      const { run, placer, record } = setup();
      placer.document.mockReturnValue(placeWith(metadata) as never);
      record.mockRejectedValue(new TypeError("boom file text"));
      await run.open();
      await Promise.resolve();
      expect(toastMock.error).toHaveBeenCalledWith(DESIGN_IMPORT_MESSAGE.metadataNotSaved);
      expect(logErrorMock).toHaveBeenCalledWith("import metadata not saved", "TypeError");
    });

    it("does not block the import while the save is slow and ignores it after unmount", async () => {
      read.mockResolvedValue({ ok: true, kind: DesignImportKind.Document, design });
      const { run, placer, record, onBusy, unmount } = setup();
      placer.document.mockReturnValue(placeWith(metadata) as never);
      const slow = deferred<{ ok: false; code: string; message: string }>();
      record.mockReturnValue(slow.promise as never);
      await run.open();
      expect(onBusy).toHaveBeenLastCalledWith(false);
      unmount();
      slow.resolve({ ok: false, code: "invalid", message: "x" });
      await slow.promise;
      await Promise.resolve();
      expect(toastMock.error).not.toHaveBeenCalled();
    });
  });
});
