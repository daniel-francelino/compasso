import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { invalid } from "@/lib/shared/server-utils";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));
vi.mock("@/lib/shared/logger", () => ({ logError: vi.fn() }));

const pdfjs = vi.hoisted(() => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: "" },
}));

vi.mock("pdfjs-dist", () => pdfjs);

const { pageRenderSize, renderPdfPage } =
  await import("@/lib/shared/design/import/render-pdf-page");
const { DESIGN_IMPORT_LIMITS } = await import("@/lib/shared/design/import/limits");
const { logError } = await import("@/lib/shared/logger");

const FAILURE = "falha de desenho";

const bytes = (): Uint8Array => Uint8Array.from([37, 80, 68, 70, 45]);

type Canvas = { width: number; height: number; getContext: () => unknown };

const setup = (render: () => { promise: Promise<unknown> }, open?: () => Promise<unknown>) => {
  const destroy = vi.fn(() => Promise.resolve());
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({ width: 300 * scale, height: 200 * scale }),
    render,
  };
  const opened = open?.() ?? Promise.resolve({ numPages: 1, getPage: () => Promise.resolve(page) });
  opened.catch(() => undefined);
  pdfjs.getDocument.mockReturnValue({ promise: opened, destroy });
  const canvases: Canvas[] = [];
  vi.stubGlobal("document", {
    createElement: () => {
      const canvas: Canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          getImageData: (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
          }),
        }),
      };
      canvases.push(canvas);
      return canvas;
    },
  });
  return { destroy, canvases };
};

beforeEach(() => {
  pdfjs.getDocument.mockReset();
  vi.mocked(logError).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("pageRenderSize edges", () => {
  it("never exceeds the page limit for any finite input", () => {
    const max = DESIGN_IMPORT_LIMITS.maxPageSide;
    for (const side of [1, 64, 2047, 2048, 2049, 4096, 16384, 1e9]) {
      const size = pageRenderSize(side, side);
      expect(size.width).toBeLessThanOrEqual(max);
      expect(size.height).toBeLessThanOrEqual(max);
    }
  });

  it("doubles up to 2048 (4096) and scales below 2x above it", () => {
    expect(pageRenderSize(2048, 2048)).toEqual({ scale: 2, width: 4096, height: 4096 });
    expect(pageRenderSize(2049, 100).scale).toBeLessThan(2);
    expect(pageRenderSize(1, 1)).toEqual({ scale: 2, width: 2, height: 2 });
  });
});

describe("renderPdfPage exception mapping", () => {
  it.each([1, 2])("maps PasswordException code %i to the encrypted message", async (code) => {
    const { destroy } = setup(
      () => ({ promise: Promise.resolve() }),
      () => Promise.reject(Object.assign(new Error("x"), { name: "PasswordException", code })),
    );
    const result = await renderPdfPage(bytes(), { usedBytes: 0, renderFailure: FAILURE });
    expect(result).toEqual(invalid(DESIGN_IMPORT_MESSAGE.encrypted));
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it.each(["InvalidPDFException", "MissingPDFException", "FormatError", "RangeError"])(
    "maps %s to the caller message without file-derived text",
    async (name) => {
      const hostile = `contents of secret-file ${name}`;
      setup(
        () => ({ promise: Promise.resolve() }),
        () => Promise.reject(Object.assign(new Error(hostile), { name })),
      );
      const result = await renderPdfPage(bytes(), { usedBytes: 0, renderFailure: FAILURE });
      expect(result).toEqual(invalid(FAILURE));
      expect(JSON.stringify(result)).not.toContain("secret-file");
    },
  );

  it("renders a document that opens without a password (owner-password-only contract)", async () => {
    setup(() => ({ promise: Promise.resolve() }));
    const result = await renderPdfPage(bytes(), { usedBytes: 0, renderFailure: FAILURE });
    expect(result.ok).toBe(true);
  });
});

describe("renderPdfPage releases resources on every path", () => {
  it("destroys the task and zeroes the canvas on success, throw and cancel", async () => {
    const success = setup(() => ({ promise: Promise.resolve() }));
    await renderPdfPage(bytes(), { usedBytes: 0, renderFailure: FAILURE });
    expect(success.destroy).toHaveBeenCalledTimes(1);
    expect(success.canvases[0]).toMatchObject({ width: 0, height: 0 });

    const thrown = setup(() => ({ promise: Promise.reject(new Error("boom")) }));
    await renderPdfPage(bytes(), { usedBytes: 0, renderFailure: FAILURE });
    expect(thrown.destroy).toHaveBeenCalledTimes(1);
    expect(thrown.canvases[0]).toMatchObject({ width: 0, height: 0 });

    const hanging = setup(() => ({ promise: new Promise(() => undefined) }));
    const controller = new AbortController();
    const pending = renderPdfPage(bytes(), {
      usedBytes: 0,
      renderFailure: FAILURE,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(hanging.canvases).toHaveLength(1));
    controller.abort();
    expect(await pending).toEqual(invalid(DESIGN_IMPORT_MESSAGE.cancelled));
    expect(hanging.destroy).toHaveBeenCalledTimes(1);
  });

  it("times out a render that never settles and destroys the task", async () => {
    vi.useFakeTimers();
    const hanging = setup(() => ({ promise: new Promise(() => undefined) }));
    const pending = renderPdfPage(bytes(), { usedBytes: 0, renderFailure: FAILURE });
    await vi.waitFor(() => expect(hanging.canvases).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(DESIGN_IMPORT_LIMITS.pdfTimeoutMs);
    expect(await pending).toEqual(invalid(DESIGN_IMPORT_MESSAGE.timedOut));
    expect(hanging.destroy).toHaveBeenCalledTimes(1);
  });
});
