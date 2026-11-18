import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/shared/design/use-raster-store", () => ({ RASTER_MEMORY_MESSAGE: "memory" }));

const { createImportPlacer } = await import("@/hooks/shared/design/use-import-place");
const { createRasterLayer, createShape, emptyPage } = await import("@/lib/shared/design/document");
const palette = { ink: "ink", surface: "surface", accent: "accent" };
const { DesignImportFormat } = await import("@/lib/shared/design/import/types");
const { DESIGN_IMPORT_MESSAGE } = await import("@/lib/shared/design/import/messages");
const { DESIGN_LIMITS, DesignElementKind, DesignPreset } =
  await import("@/lib/shared/design/types");

const designOf = (ids: string[], side = 10) => ({
  format: DesignImportFormat.Psd,
  width: side,
  height: side,
  elements: ids.map((id) => createRasterLayer(id, emptyPage("p"), { width: side, height: side })),
  buffers: new Map(
    ids.map((id) => [id, { width: side, height: side, data: new Uint8ClampedArray(0) }]),
  ),
  notes: [],
});

const harness = (options: {
  existing?: number;
  used?: number;
  setOk?: (id: string) => boolean;
}) => {
  const set = vi.fn((id: string) => options.setOk?.(id) ?? true);
  const release = vi.fn();
  const markChanged = vi.fn();
  const addImported = vi.fn((..._args: unknown[]) => true);
  const existing = options.existing ?? 0;
  const placer = createImportPlacer({
    store: { set, release, markChanged, usedBytes: () => options.used ?? 0 },
    editor: {
      page: {
        ...emptyPage("p"),
        elements: Array.from({ length: existing }, (_, index) =>
          createRasterLayer(`e${index}`, emptyPage("p"), { width: 1, height: 1 }),
        ),
      },
      canAdd: (count = 1) => existing + count <= DESIGN_LIMITS.maxElements,
      addImported,
    },
    preset: DesignPreset.FeedSquare,
  });
  return { placer, set, release, markChanged, addImported };
};

describe("createImportPlacer", () => {
  it("refuses when the elements do not fit, before touching the store", () => {
    const h = harness({ existing: 150 });
    const result = h.placer.document(designOf(Array.from({ length: 51 }, (_, i) => `n${i}`)));
    expect(result).toMatchObject({
      ok: false,
      message: DESIGN_IMPORT_MESSAGE.tooManyLayers(DESIGN_LIMITS.maxElements),
    });
    expect(h.set).not.toHaveBeenCalled();
    expect(h.addImported).not.toHaveBeenCalled();
  });

  it("counts elements without a buffer, such as groups, against the capacity", () => {
    const h = harness({ existing: 150 });
    const base = designOf(["leaf"]);
    const extra = Array.from({ length: 50 }, (_, index) =>
      createShape(`g${index}`, DesignElementKind.Rect, DesignPreset.FeedSquare, palette),
    );
    const result = h.placer.document({ ...base, elements: [...base.elements, ...extra] });
    expect(result).toMatchObject({ ok: false });
    expect(h.set).not.toHaveBeenCalled();
  });

  it("accepts exactly the remaining capacity", () => {
    const h = harness({ existing: 150 });
    const result = h.placer.document(designOf(Array.from({ length: 50 }, (_, i) => `n${i}`)));
    expect(result.ok).toBe(true);
    expect(h.markChanged).toHaveBeenCalledTimes(50);
  });

  it("refuses over the raster budget re-checked at placement", () => {
    const h = harness({ used: DESIGN_LIMITS.rasterBudgetBytes });
    const result = h.placer.image(designOf(["a"]));
    expect(result).toMatchObject({ ok: false, message: "memory" });
    expect(h.set).not.toHaveBeenCalled();
    expect(h.addImported).not.toHaveBeenCalled();
  });

  it("rolls back every stored buffer when one set fails", () => {
    const h = harness({ setOk: (id) => id !== "c" });
    const result = h.placer.document(designOf(["a", "b", "c"]));
    expect(result).toMatchObject({ ok: false, message: "memory" });
    expect(h.release.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
    expect(h.markChanged).not.toHaveBeenCalled();
    expect(h.addImported).not.toHaveBeenCalled();
  });

  it("releases every buffer when the editor throws", () => {
    const h = harness({});
    h.addImported.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => h.placer.document(designOf(["a", "b"]))).toThrow("boom");
    expect(h.release.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
    expect(h.markChanged).not.toHaveBeenCalled();
  });

  it("marks changed and names the history step after the format", () => {
    const h = harness({});
    const result = h.placer.image(designOf(["a"]));
    expect(result.ok).toBe(true);
    expect(h.markChanged).toHaveBeenCalledWith("a");
    expect(h.addImported).toHaveBeenCalledWith(
      expect.any(Array),
      { width: 64, height: 64 },
      "Importar PSD",
    );
  });
});
