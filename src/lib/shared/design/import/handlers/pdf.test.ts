import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as RenderModule from "@/lib/shared/design/import/render-pdf-page";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));

const render = vi.hoisted(() => ({ probe: vi.fn(), page: vi.fn() }));

vi.mock("@/lib/shared/design/import/render-pdf-page", async (importActual) => ({
  ...(await importActual<typeof RenderModule>()),
  probeOrRenderPdfPage: render.probe,
  renderPdfPage: render.page,
}));

const { pdfHandler } = await import("@/lib/shared/design/import/handlers/pdf");
const { DESIGN_IMPORT_MESSAGE, PDF_PAGE_CHOICE } =
  await import("@/lib/shared/design/import/messages");
const { IMPORT_NEEDS_CHOICE } = await import("@/lib/shared/design/import/types");

const bytes = Uint8Array.from("%PDF-1.7 body", (character) => character.charCodeAt(0));
const file = new File([bytes], "a.pdf");

const input = () => ({
  bytes,
  file,
  newId: () => "id",
  usedBytes: 0,
  capacityElements: 200,
});

const pageOf = (pageCount: number) => ({
  ok: true as const,
  width: 100,
  height: 80,
  data: new Uint8ClampedArray(100 * 80 * 4),
  pageCount,
  naturalWidth: 50,
  naturalHeight: 40,
});

const decode = async () => {
  if (pdfHandler.runsIn !== "main") throw new Error("main expected");
  return pdfHandler.decode(input());
};

beforeEach(() => vi.clearAllMocks());

describe("pdfHandler page selection", () => {
  it("imports a one-page PDF without a dialog and without the first-page note", async () => {
    render.probe.mockResolvedValue(pageOf(1));
    const result = await decode();
    expect(result.ok && result.kind).toBe("image");
    expect(result.ok && "design" in result && result.design.notes).toEqual([]);
  });

  it("returns a choice with one option per page, then renders the chosen page", async () => {
    render.probe.mockResolvedValue({ ok: true, choose: true, pageCount: 5 });
    render.page.mockResolvedValue(pageOf(5));
    const result = await decode();
    if (!result.ok || result.kind !== IMPORT_NEEDS_CHOICE) throw new Error("choice expected");
    expect(result.choice.title).toBe(PDF_PAGE_CHOICE.title);
    expect(result.choice.options.map((option) => option.id)).toEqual(["1", "2", "3", "4", "5"]);
    const resumed = await result.resume("3");
    expect(render.page).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({ pageNumber: 3 }),
    );
    expect(resumed.ok && "design" in resumed && resumed.design.notes).toEqual([]);
  });

  it("lists at most 500 options for a PDF that declares 100000 pages", async () => {
    render.probe.mockResolvedValue({ ok: true, choose: true, pageCount: 100000 });
    const result = await decode();
    if (!result.ok || result.kind !== IMPORT_NEEDS_CHOICE) throw new Error("choice expected");
    expect(result.choice.options).toHaveLength(500);
  });

  it("refuses a resumed id that is not a positive integer without rendering", async () => {
    render.probe.mockResolvedValue({ ok: true, choose: true, pageCount: 5 });
    const result = await decode();
    if (!result.ok || result.kind !== IMPORT_NEEDS_CHOICE) throw new Error("choice expected");
    for (const id of ["0", "-1", "1.5", "abc", "", "1e3", "99999999999"]) {
      const resumed = await result.resume(id);
      expect(resumed.ok).toBe(false);
      expect(!resumed.ok && resumed.message).toBe(DESIGN_IMPORT_MESSAGE.pdfPageInvalid);
    }
    expect(render.page).not.toHaveBeenCalled();
  });

  it("passes a refusal of the probe through", async () => {
    render.probe.mockResolvedValue({ ok: false, code: "invalid", message: "x" });
    const result = await decode();
    expect(result.ok).toBe(false);
  });

  it("says so in the title when more than 500 pages exist", async () => {
    render.probe.mockResolvedValue({ ok: true, choose: true, pageCount: 650 });
    const result = await decode();
    if (!result.ok || result.kind !== IMPORT_NEEDS_CHOICE) throw new Error("choice expected");
    expect(result.choice.options).toHaveLength(500);
    expect(result.choice.title).toContain("500");
    expect(result.choice.title).toContain("650");
  });

  it("does not render a page once the signal is aborted", async () => {
    render.probe.mockResolvedValue({ ok: true, choose: true, pageCount: 3 });
    const result = await decode();
    if (!result.ok || result.kind !== IMPORT_NEEDS_CHOICE) throw new Error("choice expected");
    const resumed = await result.resume("2", AbortSignal.abort());
    expect(resumed.ok).toBe(false);
    expect(render.page).not.toHaveBeenCalled();
  });
});
