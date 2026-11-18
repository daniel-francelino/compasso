import { describe, expect, it } from "vitest";
import { createRasterLayer, emptyPage } from "@/lib/shared/design/document";
import { placeDocumentDesign, placeImageDesign } from "@/lib/shared/design/import/placement";
import {
  DesignImportFormat,
  DesignImportNoteKind,
  type ImportedDesign,
} from "@/lib/shared/design/import/types";

const imageOf = (
  width: number,
  height: number,
  notes: ImportedDesign["notes"] = [],
): ImportedDesign => ({
  format: DesignImportFormat.Png,
  width,
  height,
  elements: [createRasterLayer("a", emptyPage("p"), { width, height })],
  buffers: new Map(),
  notes,
  metadata: null,
});

const box = (design: ReturnType<typeof placeImageDesign>) => {
  const [element] = design.elements;
  return { x: element?.x, y: element?.y, width: element?.width, height: element?.height };
};

describe("placeImageDesign", () => {
  it("makes an empty page take the decoded size", () => {
    const placed = placeImageDesign(imageOf(800, 600), { width: 1080, height: 1080, empty: true });
    expect(placed.size).toEqual({ width: 800, height: 600 });
    expect(box(placed)).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(placed.notes).toEqual([]);
  });

  it("clamps an empty page below 64 px and centers the layer on it", () => {
    const placed = placeImageDesign(imageOf(30, 500), { width: 1080, height: 1080, empty: true });
    expect(placed.size).toEqual({ width: 64, height: 500 });
    expect(box(placed)).toEqual({ x: 17, y: 0, width: 30, height: 500 });
  });

  it("clamps an empty page above 4096 px and scales the layer with a note", () => {
    const placed = placeImageDesign(imageOf(5000, 1000), {
      width: 1080,
      height: 1080,
      empty: true,
    });
    expect(placed.size).toEqual({ width: 4096, height: 1000 });
    expect(box(placed).width).toBe(4096);
    expect(placed.notes).toEqual([{ kind: DesignImportNoteKind.Downscaled, count: 1 }]);
  });

  it("never upscales on a non-empty page and centers with integers", () => {
    const placed = placeImageDesign(imageOf(101, 50), { width: 1080, height: 1080, empty: false });
    expect(placed.size).toBeNull();
    expect(box(placed)).toEqual({ x: 490, y: 515, width: 101, height: 50 });
    expect(placed.notes).toEqual([]);
  });

  it("fits a larger image inside the page, centered, and adds the note once", () => {
    const placed = placeImageDesign(
      imageOf(2000, 1000, [{ kind: DesignImportNoteKind.Downscaled, count: 1 }]),
      { width: 1000, height: 1000, empty: false },
    );
    expect(box(placed)).toEqual({ x: 0, y: 250, width: 1000, height: 500 });
    expect(placed.notes).toEqual([{ kind: DesignImportNoteKind.Downscaled, count: 1 }]);
  });

  it("appends the downscaled note when the handler did not add one", () => {
    const placed = placeImageDesign(imageOf(3000, 3000), {
      width: 1000,
      height: 500,
      empty: false,
    });
    expect(box(placed)).toEqual({ x: 250, y: 0, width: 500, height: 500 });
    expect(placed.notes).toEqual([{ kind: DesignImportNoteKind.Downscaled, count: 1 }]);
  });

  it("keeps the layer size at least 1 for an extreme aspect ratio", () => {
    const placed = placeImageDesign(imageOf(4096, 2), { width: 64, height: 64, empty: false });
    expect(box(placed).height).toBe(1);
    expect(box(placed).width).toBe(64);
  });
});

describe("placeDocumentDesign", () => {
  it("resizes only an empty page and keeps the elements and notes", () => {
    const design = imageOf(300, 200, [{ kind: DesignImportNoteKind.GroupsFlattened, count: 2 }]);
    const empty = placeDocumentDesign(design, { width: 1080, height: 1080, empty: true });
    expect(empty.size).toEqual({ width: 300, height: 200 });
    expect(empty.elements).toBe(design.elements);
    const filled = placeDocumentDesign(design, { width: 1080, height: 1080, empty: false });
    expect(filled.size).toBeNull();
    expect(filled.notes).toBe(design.notes);
  });
});
