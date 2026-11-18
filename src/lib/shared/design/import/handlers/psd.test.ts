import { describe, expect, it } from "vitest";
import { psdToDesign, readPsdHeader } from "@/lib/shared/design/import/handlers/psd";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { buildMetadata } from "@/lib/shared/design/import/metadata";
import {
  DesignImportColorMode,
  DesignImportFormat,
  DesignImportNoteKind,
} from "@/lib/shared/design/import/types";
import {
  counter,
  documentOf,
  groupNode,
  layerNode,
  psdHeader,
  square,
} from "@/lib/shared/design/import/worker/test-fixtures";
import { DesignBlendMode, DesignElementKind } from "@/lib/shared/design/types";

const BIDI = String.fromCharCode(0x202e);
const NUL = String.fromCharCode(0);
const NL = String.fromCharCode(10);

describe("readPsdHeader", () => {
  it("reads size and color mode", () => {
    const result = readPsdHeader(psdHeader(1, 1080, 1350, 3));
    expect(result.ok && result.header).toEqual({
      width: 1080,
      height: 1350,
      depth: 8,
      colorMode: 3,
    });
  });

  it("refuses PSB, big canvases and unsupported color modes", () => {
    const psb = readPsdHeader(psdHeader(2, 100, 100, 3));
    expect(!psb.ok && psb.message).toBe(DESIGN_IMPORT_MESSAGE.psb);
    expect(readPsdHeader(psdHeader(1, 5000, 100, 3)).ok).toBe(false);
    expect(readPsdHeader(psdHeader(1, 100, 100, 9)).ok).toBe(false);
    expect(readPsdHeader(new Uint8Array(4)).ok).toBe(false);
  });

  it("checks the page size boundaries on each axis", () => {
    const cases: [number, number, boolean][] = [
      [64, 64, true],
      [4096, 4096, true],
      [63, 64, false],
      [64, 63, false],
      [4097, 64, false],
      [64, 4097, false],
      [0, 0, false],
      [0xffffffff, 0xffffffff, false],
    ];
    for (const [width, height, ok] of cases) {
      expect(readPsdHeader(psdHeader(1, width, height, 3)).ok).toBe(ok);
    }
  });
});

describe("psdToDesign", () => {
  it("keeps order, names, visibility, opacity, blend mode and position", () => {
    const doc = documentOf([
      layerNode("Fundo", square(0, 0, 200)),
      layerNode("Foto", square(20, 30, 50), {
        hidden: true,
        opacity: 0.5,
        fillOpacity: 0.25,
        blendMode: "multiply",
      }),
    ]);
    const result = psdToDesign(doc, { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [first, second] = result.design.elements;
    expect(first?.name).toBe("Fundo");
    expect(second).toMatchObject({
      kind: DesignElementKind.Raster,
      name: "Foto",
      x: 20,
      y: 30,
      width: 50,
      height: 50,
      hidden: true,
      opacity: 0.5,
      fillOpacity: 0.25,
      blendMode: DesignBlendMode.Multiply,
    });
    expect(result.design.buffers.size).toBe(2);
  });

  it("maps groups to parentId and drops empty groups", () => {
    const doc = documentOf([
      groupNode("Grupo", 0, { opacity: 0.8 }),
      layerNode("Dentro", square(0, 0, 10), { depth: 1 }),
      groupNode("Vazio", 0),
    ]);
    const result = psdToDesign(doc, { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [group, child] = result.design.elements;
    expect(result.design.elements).toHaveLength(2);
    expect(group).toMatchObject({ kind: DesignElementKind.Group, opacity: 0.8 });
    expect(child?.parentId).toBe(group?.id);
  });

  it("notes text, effects, adjustments and unsupported blend modes in a stable order", () => {
    const doc = documentOf([
      layerNode("Texto", square(0, 0, 10), { text: true }),
      layerNode("Sombra", square(0, 0, 10), { effects: true, blendMode: "vivid light" }),
      layerNode("Curvas", null, { adjustment: true }),
    ]);
    const result = psdToDesign(doc, { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.elements).toHaveLength(2);
    expect(result.design.notes).toEqual([
      { kind: DesignImportNoteKind.TextAsPixels, count: 1 },
      { kind: DesignImportNoteKind.LayerStyleDropped, count: 1 },
      { kind: DesignImportNoteKind.AdjustmentLayerDropped, count: 1 },
      { kind: DesignImportNoteKind.BlendModeFallback, count: 1 },
    ]);
  });

  it("notes the flattened image, CMYK and reduced depth", () => {
    const doc = documentOf([layerNode("Imagem", square(0, 0, 64))], 64, {
      flattened: true,
      cmyk: true,
      depthReduced: true,
    });
    const result = psdToDesign(doc, { newId: counter() });
    expect(result.ok && result.design.notes.map((note) => note.kind)).toEqual([
      DesignImportNoteKind.FlattenedImageOnly,
      DesignImportNoteKind.CmykConverted,
      DesignImportNoteKind.DepthReduced,
    ]);
  });

  it("refuses a file without pixels and a file over the memory budget", () => {
    const empty = psdToDesign(documentOf([layerNode("A", null)], 64), { newId: counter() });
    expect(!empty.ok && empty.message).toBe(DESIGN_IMPORT_MESSAGE.noLayers);
    const big = psdToDesign(documentOf([layerNode("A", square(0, 0, 100))], 100), {
      newId: counter(),
      budgetBytes: 1000,
    });
    expect(!big.ok && big.message).toBe(DESIGN_IMPORT_MESSAGE.memory);
  });

  it("clips a layer only above a pixel layer", () => {
    const doc = documentOf(
      [
        layerNode("Base", square(0, 0, 10)),
        layerNode("Cortada", square(0, 0, 10), { clipping: true }),
        groupNode("Grupo", 0),
        layerNode("Solta", square(0, 0, 10), { clipping: true, depth: 1 }),
      ],
      64,
    );
    const result = psdToDesign(doc, { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.elements.map((element) => element.clipToBelow)).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(result.design.notes).toEqual([{ kind: DesignImportNoteKind.ClippingPartial, count: 1 }]);
  });

  it("sanitizes names and falls back when empty", () => {
    const hostile = "a" + BIDI + "b" + NUL + "c" + NL + "<img onerror=alert(1)>" + "x".repeat(200);
    const doc = documentOf([layerNode(hostile, square(0, 0, 10)), layerNode("", square(0, 0, 10))]);
    const result = psdToDesign(doc, { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [first, second] = result.design.elements;
    expect(first?.name.length).toBeLessThanOrEqual(80);
    expect(first?.name).toContain("<img onerror=alert(1)>");
    for (const bad of [BIDI, NUL, NL]) expect(first?.name).not.toContain(bad);
    expect(second?.name).toBe("Camada");
  });

  it("walks a 5000-level group tree without recursion and flattens past the depth limit", () => {
    const nodes = Array.from({ length: 5000 }, (_, depth) => groupNode(`g${depth}`, depth));
    nodes.push(layerNode("Fundo", square(0, 0, 10), { depth: 5000 }));
    const result = psdToDesign(documentOf(nodes, 64), { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const groups = result.design.elements.filter((e) => e.kind === DesignElementKind.Group);
    expect(groups).toHaveLength(7);
    expect(result.design.notes).toEqual([
      { kind: DesignImportNoteKind.GroupsFlattened, count: 4993 },
    ]);
  });

  it("takes a descriptor that survives structuredClone (no functions, no ids)", () => {
    const doc = documentOf([layerNode("A", square(0, 0, 10))]);
    expect(() => structuredClone(doc)).not.toThrow();
  });
});

describe("psdToDesign metadata", () => {
  it("passes the worker metadata through, and null does not fail the import", () => {
    const nodes = [layerNode("a", square(0, 0, 10))];
    const none = psdToDesign(documentOf(nodes), { newId: counter() });
    expect(none.ok && none.design.metadata).toBeNull();
    const metadata = buildMetadata({
      source: {
        format: DesignImportFormat.Psd,
        colorMode: DesignImportColorMode.Rgb,
        bitsPerChannel: 8,
        pageCount: null,
      },
      dimensions: { sourceWidth: 200, sourceHeight: 200, pageWidth: 200, pageHeight: 200 },
    });
    const withIt = psdToDesign(documentOf(nodes, 200, { metadata }), { newId: counter() });
    expect(withIt.ok && withIt.design.metadata).toBe(metadata);
  });
});
