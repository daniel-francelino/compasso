import { describe, expect, it } from "vitest";
import {
  addElement,
  createRasterLayer,
  emptyDocument,
  emptyPage,
  newLayerName,
  rasterPixelsIds,
  removeElements,
  resolveInheritance,
  rgbToHex,
} from "@/lib/shared/design/document";
import { AdjustmentType } from "@/lib/shared/design/raster/adjustment-types";
import { designDocumentSchema, designDocumentV3Schema } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignElementKind } from "@/lib/shared/design/types";

const mediaId = "0b0a1f4e-6f0d-4a8e-9a55-3c1a2b9d7e10";
const size = { width: 1080, height: 1080 };
const FILL = rgbToHex(17, 34, 51);

const base = { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, locked: false };
const rasterBase = {
  ...base,
  id: "r",
  kind: DesignElementKind.Raster,
  pixelWidth: 4,
  pixelHeight: 4,
};
const rect = (id: string) => ({
  ...base,
  id,
  kind: DesignElementKind.Rect,
  fill: FILL,
  cornerRadius: 0,
});
const group = (id: string, parentId: string | null) => ({
  ...base,
  id,
  kind: DesignElementKind.Group,
  parentId,
});

const documentOf = (elements: object[]) => ({
  version: 3,
  pages: [{ id: "p", background: null, elements }],
});
const parses = (value: unknown) => designDocumentV3Schema.safeParse(value).success;

describe("document version 3", () => {
  it("creates an empty raster layer the size of the page with a derived name", () => {
    const page = emptyPage("p");
    const layer = createRasterLayer("r1", page, size);
    expect(layer).toMatchObject({
      kind: DesignElementKind.Raster,
      width: 1080,
      pixelWidth: 1080,
      pixelsVersionId: null,
      name: "Camada 1",
    });
    const next = addElement(page, layer);
    expect(newLayerName(next)).toBe("Camada 2");
    expect(parses({ version: 3, pages: [next] })).toBe(true);
  });

  it("writes version 3 and reads version 1 and 2 with the new defaults", () => {
    expect(emptyDocument().version).toBe(3);
    const element = { ...rect("e"), kind: DesignElementKind.Ellipse };
    const upgraded = designDocumentSchema.parse({
      version: 2,
      pages: [{ id: "p", background: null, elements: [element] }],
    });
    expect(upgraded.version).toBe(3);
    expect(upgraded.pages[0]?.elements[0]).toMatchObject({
      parentId: null,
      clipToBelow: false,
      mask: null,
    });
    const fromOne = designDocumentSchema.parse({
      version: 1,
      background: null,
      elements: [element],
    });
    expect(fromOne.version).toBe(3);
    expect(fromOne.pages).toHaveLength(1);
  });

  it("does not accept the new kinds in a version 2 document", () => {
    const parsed = designDocumentSchema.safeParse({
      version: 2,
      pages: [{ id: "p", background: null, elements: [rasterBase] }],
    });
    expect(parsed.success).toBe(false);
  });

  it("validates raster pixel size, adjustment parameters and group flags", () => {
    const adjustment = {
      ...base,
      id: "a",
      kind: DesignElementKind.Adjustment,
      adjustment: { type: AdjustmentType.Invert },
    };
    expect(parses(documentOf([rasterBase, adjustment, group("g", null)]))).toBe(true);
    const tooBig = { ...rasterBase, pixelWidth: DESIGN_LIMITS.maxRasterSide + 1 };
    expect(parses(documentOf([tooBig]))).toBe(false);
    expect(parses(documentOf([{ ...rasterBase, pixelHeight: 0 }]))).toBe(false);
    expect(parses(documentOf([{ ...adjustment, adjustment: { type: "sepia" } }]))).toBe(false);
    expect(parses(documentOf([{ ...rasterBase, pixelsVersionId: "not-a-uuid" }]))).toBe(false);
  });

  it("validates the mask and the optional page size", () => {
    const masked = { mediaVersionId: mediaId, enabled: true, linked: false };
    expect(parses(documentOf([{ ...rasterBase, mask: masked }]))).toBe(true);
    const badMask = { ...masked, mediaVersionId: "x" };
    expect(parses(documentOf([{ ...rasterBase, mask: badMask }]))).toBe(false);
    const sized = { id: "p", background: null, width: 64, height: 4096, elements: [] };
    expect(parses({ version: 3, pages: [sized] })).toBe(true);
    expect(parses({ version: 3, pages: [{ ...sized, width: 63 }] })).toBe(false);
  });

  it("requires parents to be groups, acyclic and at most eight levels deep", () => {
    expect(parses(documentOf([group("g1", null), { ...rect("l"), parentId: "g1" }]))).toBe(true);
    expect(parses(documentOf([rect("m"), { ...rect("l"), parentId: "m" }]))).toBe(false);
    expect(parses(documentOf([{ ...rect("l"), parentId: "nope" }]))).toBe(false);
    expect(parses(documentOf([group("a", "b"), group("b", "a")]))).toBe(false);
    const chain = (depth: number) => {
      const groups = Array.from({ length: depth }, (_, i) =>
        group(`g${i}`, i === 0 ? null : `g${i - 1}`),
      );
      return documentOf([...groups, { ...rect("l"), parentId: `g${depth - 1}` }]);
    };
    expect(parses(chain(8))).toBe(true);
    expect(parses(chain(9))).toBe(false);
  });

  it("allows 200 elements in version 3 and keeps 100 for version 2", () => {
    const many = (count: number) => Array.from({ length: count }, (_, i) => rect(`e${i}`));
    expect(parses(documentOf(many(200)))).toBe(true);
    expect(parses(documentOf(many(201)))).toBe(false);
    const legacy = (count: number) => ({
      version: 2,
      pages: [{ id: "p", background: null, elements: many(count) }],
    });
    expect(designDocumentSchema.safeParse(legacy(100)).success).toBe(true);
    expect(designDocumentSchema.safeParse(legacy(101)).success).toBe(false);
  });

  it("inherits hidden and opacity from the group chain and reparents on removal", () => {
    const parent = { ...group("g", null), hidden: true, opacity: 0.5 };
    const child = { ...rect("r"), opacity: 0.5, parentId: "g" };
    const page = designDocumentV3Schema.parse(documentOf([parent, child])).pages[0];
    expect(page).toBeDefined();
    if (page === undefined) return;
    expect(resolveInheritance(page)[1]).toMatchObject({ hidden: true, opacity: 0.25 });
    expect(removeElements(page, ["g"]).elements[0]?.parentId).toBeNull();
  });

  it("lists the pixel files referenced by raster layers once", () => {
    const raster = (id: string) => ({ ...rasterBase, id, pixelsVersionId: mediaId });
    const parsed = designDocumentV3Schema.parse(documentOf([raster("a"), raster("b")]));
    expect(rasterPixelsIds(parsed)).toEqual([mediaId]);
  });
});
