import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { DesignImportFormat } from "@/lib/shared/design/import/types";
import { invalid } from "@/lib/shared/server-utils";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));

const pdfjs = vi.hoisted(() => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: "" },
}));

vi.mock("pdfjs-dist", () => pdfjs);

const { buildPdfOpenOptions, extractPdfBytes, pageRenderSize, renderPdfPage, renderPdfPageDesign } =
  await import("@/lib/shared/design/import/render-pdf-page");

const FAILURE = "falha de desenho";
const PDF = "%PDF-1.7";

const bytesOf = (text: string): Uint8Array =>
  Uint8Array.from(text, (character) => character.charCodeAt(0));

const textOf = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

const render = (used = 0) =>
  renderPdfPage(bytesOf(PDF), { usedBytes: used, renderFailure: FAILURE });

type FakeCanvas = {
  width: number;
  height: number;
  getContext: () => unknown;
};

type Scenario = {
  viewport?: { width: number; height: number };
  numPages?: number;
  open?: () => Promise<unknown>;
};

const setup = (scenario: Scenario = {}) => {
  const viewport = scenario.viewport ?? { width: 300, height: 200 };
  const destroy = vi.fn(() => Promise.resolve());
  const getPage = vi.fn(() =>
    Promise.resolve({
      getViewport: ({ scale }: { scale: number }) => ({
        width: viewport.width * scale,
        height: viewport.height * scale,
      }),
      render: () => ({ promise: Promise.resolve() }),
    }),
  );
  const opened =
    scenario.open?.() ?? Promise.resolve({ numPages: scenario.numPages ?? 1, getPage });
  opened.catch(() => undefined);
  pdfjs.getDocument.mockReturnValue({ promise: opened, destroy });
  const canvases: FakeCanvas[] = [];
  const create = vi.fn((_tag: string) => {
    const canvas: FakeCanvas = {
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
  });
  vi.stubGlobal("document", { createElement: create });
  return { destroy, getPage, canvases, create };
};

beforeEach(() => {
  pdfjs.getDocument.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("extractPdfBytes", () => {
  it("returns the same bytes when the file starts with a PDF header", () => {
    const bytes = bytesOf("%PDF-1.6 body");
    expect(extractPdfBytes(bytes)).toBe(bytes);
  });

  it("finds a PDF stream after a PostScript prolog", () => {
    const found = extractPdfBytes(bytesOf("%!PS-Adobe-3.0\n%%prolog\n%PDF-1.5 body"));
    expect(found === null ? null : textOf(found)).toBe("%PDF-1.5 body");
  });

  it("returns null when there is no PDF stream", () => {
    expect(extractPdfBytes(bytesOf("%!PS-Adobe-3.0\nshowpage"))).toBeNull();
  });
});

describe("pageRenderSize", () => {
  it("renders at 2x when it fits", () => {
    expect(pageRenderSize(540, 675)).toEqual({ scale: 2, width: 1080, height: 1350 });
  });

  it("never passes 4096 px", () => {
    const size = pageRenderSize(3000, 1500);
    expect(size.width).toBeLessThanOrEqual(4096);
    expect(size.height).toBeLessThanOrEqual(4096);
  });
});

describe("buildPdfOpenOptions", () => {
  const data = new Uint8Array([1, 2, 3]);
  const options = buildPdfOpenOptions(data);

  it("passes the bytes as data and no url", () => {
    expect(options.data).toBe(data);
    expect(options).not.toHaveProperty("url");
  });

  it("turns off fetching, streaming, ranges, XFA and worker fetch", () => {
    expect(options).toMatchObject({
      disableAutoFetch: true,
      disableStream: true,
      disableRange: true,
      enableXfa: false,
      useWorkerFetch: false,
      stopAtErrors: false,
      maxImageSize: DESIGN_IMPORT_LIMITS.aiMaxImagePixels,
    });
  });

  it("has no URL option and no option the installed version lacks", () => {
    for (const name of [
      "cMapUrl",
      "standardFontDataUrl",
      "iccUrl",
      "wasmUrl",
      "isEvalSupported",
      "enableScripting",
    ]) {
      expect(options).not.toHaveProperty(name);
    }
  });
});

describe("renderPdfPage", () => {
  it("renders the first page only and always destroys the task", async () => {
    const { destroy, getPage, canvases } = setup({ numPages: 100000 });
    const result = await render();
    expect(result).toMatchObject({ ok: true, width: 600, height: 400, pageCount: 100000 });
    expect(getPage).toHaveBeenCalledTimes(1);
    expect(getPage).toHaveBeenCalledWith(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
  });

  it("uses the pure options function at the real call site", async () => {
    setup();
    const bytes = new Uint8Array([37, 80, 68, 70, 45]);
    await renderPdfPage(bytes, { usedBytes: 0, renderFailure: FAILURE });
    expect(pdfjs.getDocument).toHaveBeenCalledWith(buildPdfOpenOptions(bytes));
  });

  it("copies the bytes only when they are a window of a larger buffer", async () => {
    setup();
    const whole = new Uint8Array([1, 2, 3, 4]);
    await renderPdfPage(whole, { usedBytes: 0, renderFailure: FAILURE });
    expect(pdfjs.getDocument.mock.calls[0]?.[0].data).toBe(whole);
    const window = whole.subarray(1);
    await renderPdfPage(window, { usedBytes: 0, renderFailure: FAILURE });
    expect(pdfjs.getDocument.mock.calls[1]?.[0].data).not.toBe(window);
  });

  it("refuses an encrypted PDF and still destroys the task", async () => {
    const { destroy } = setup({
      open: () =>
        Promise.reject(Object.assign(new Error("password"), { name: "PasswordException" })),
    });
    expect(await render()).toEqual(invalid(DESIGN_IMPORT_MESSAGE.encrypted));
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("maps any other open error to the caller's message", async () => {
    setup({ open: () => Promise.reject(new Error("InvalidPDFException")) });
    expect(await render()).toEqual(invalid(FAILURE));
  });

  it.each([
    ["NaN", { width: Number.NaN, height: 100 }],
    ["Infinity", { width: Number.POSITIVE_INFINITY, height: 100 }],
    ["zero", { width: 0, height: 100 }],
    ["negative", { width: 100, height: -5 }],
  ])("refuses a %s viewport before creating a canvas", async (_name, viewport) => {
    const { create, destroy } = setup({ viewport });
    expect(await render()).toEqual(invalid(FAILURE));
    expect(create).not.toHaveBeenCalledWith("canvas");
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("refuses a huge page before creating a canvas", async () => {
    const { create } = setup({ viewport: { width: 1e9, height: 1e9 } });
    expect(await render()).toEqual(invalid(DESIGN_IMPORT_MESSAGE.canvasTooLarge));
    expect(create).not.toHaveBeenCalledWith("canvas");
  });

  it("refuses a page that would render below the minimum before creating a canvas", async () => {
    const { create } = setup({ viewport: { width: 10, height: 10 } });
    expect(await render()).toEqual(invalid(DESIGN_IMPORT_MESSAGE.canvasTooSmall));
    expect(create).not.toHaveBeenCalledWith("canvas");
  });

  it("refuses when the planned canvas does not fit the remaining raster budget", async () => {
    const { create } = setup();
    expect(await render(DESIGN_LIMITS.rasterBudgetBytes - 1)).toEqual(
      invalid(DESIGN_IMPORT_MESSAGE.memory),
    );
    expect(create).not.toHaveBeenCalledWith("canvas");
  });

  it("gives up after the time budget and destroys the task", async () => {
    vi.useFakeTimers();
    const { destroy } = setup({ open: () => new Promise(() => undefined) });
    const pending = render();
    await vi.waitFor(() => expect(pdfjs.getDocument).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(DESIGN_IMPORT_LIMITS.pdfTimeoutMs);
    expect(await pending).toEqual(invalid(DESIGN_IMPORT_MESSAGE.timedOut));
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys the task and reports a cancel when the signal aborts", async () => {
    const { destroy } = setup({ open: () => new Promise(() => undefined) });
    const controller = new AbortController();
    const pending = renderPdfPage(bytesOf(PDF), {
      usedBytes: 0,
      renderFailure: FAILURE,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(pdfjs.getDocument).toHaveBeenCalled());
    controller.abort();
    expect(await pending).toEqual(invalid(DESIGN_IMPORT_MESSAGE.cancelled));
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("releases the canvas when drawing fails", async () => {
    const { canvases } = setup();
    pdfjs.getDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: () =>
          Promise.resolve({
            getViewport: () => ({ width: 300, height: 200 }),
            render: () => ({ promise: Promise.reject(new Error("render")) }),
          }),
      }),
      destroy: vi.fn(() => Promise.resolve()),
    });
    expect(await render()).toEqual(invalid(FAILURE));
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
  });
});

describe("renderPdfPageDesign", () => {
  const input = (fileName: string, bytes = bytesOf(`junk ${PDF}`)) => ({
    bytes,
    fileName,
    newId: () => "layer-1",
    usedBytes: 0,
  });

  it("builds one raster layer named after the file, with the first-page note", async () => {
    setup({ numPages: 3 });
    const result = await renderPdfPageDesign(
      DesignImportFormat.Pdf,
      input("menu.final.pdf"),
      FAILURE,
    );
    if (!result.ok) throw new Error("expected success");
    expect(result.design.format).toBe("pdf");
    expect(result.design.elements).toHaveLength(1);
    expect(result.design.elements[0]).toMatchObject({ id: "layer-1", name: "menu.final" });
    expect(result.design.notes).toEqual([{ kind: "first_page_only", count: 1 }]);
  });

  it("adds no note for a single page and falls back to a default name", async () => {
    setup({ numPages: 1 });
    const result = await renderPdfPageDesign(DesignImportFormat.Ai, input("  .pdf"), FAILURE);
    if (!result.ok) throw new Error("expected success");
    expect(result.design.notes).toEqual([]);
    expect(result.design.elements[0]).toMatchObject({ name: "Arte" });
  });

  it("refuses bytes with no PDF stream without opening pdf.js", async () => {
    setup();
    const result = await renderPdfPageDesign(
      DesignImportFormat.Pdf,
      input("a.pdf", bytesOf("nope")),
      FAILURE,
    );
    expect(result.ok).toBe(false);
    expect(pdfjs.getDocument).not.toHaveBeenCalled();
  });
});
