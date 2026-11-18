import type { Layer, Psd } from "ag-psd";
import { describe, expect, it } from "vitest";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/design-import";
import { psdToDesign, readPsdHeader } from "@/lib/shared/design/psd-import";
import { DesignBlendMode, DesignElementKind } from "@/lib/shared/design/types";

const counter = () => {
  let next = 0;
  return () => {
    next += 1;
    return `id-${next}`;
  };
};

const pixels = (width: number, height: number, rgba: [number, number, number, number]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) data.set(rgba, index);
  return { width, height, data };
};

const solid = (
  name: string,
  left: number,
  top: number,
  size: number,
  extra: Layer = {},
): Layer => ({
  name,
  left,
  top,
  right: left + size,
  bottom: top + size,
  opacity: 1,
  imageData: pixels(size, size, [200, 10, 10, 255]),
  ...extra,
});

const header = (version: number, width: number, height: number, mode: number): Uint8Array => {
  const bytes = new Uint8Array(26);
  const view = new DataView(bytes.buffer);
  bytes.set([0x38, 0x42, 0x50, 0x53]);
  view.setUint16(4, version);
  view.setUint32(14, height);
  view.setUint32(18, width);
  view.setUint16(22, 8);
  view.setUint16(24, mode);
  return bytes;
};

describe("readPsdHeader", () => {
  it("reads size and color mode", () => {
    const result = readPsdHeader(header(1, 1080, 1350, 3));
    expect(result.ok && result.header).toEqual({
      width: 1080,
      height: 1350,
      depth: 8,
      colorMode: 3,
    });
  });

  it("refuses PSB, big canvases and unsupported color modes", () => {
    const psb = readPsdHeader(header(2, 100, 100, 3));
    expect(!psb.ok && psb.message).toBe(DESIGN_IMPORT_MESSAGE.psb);
    expect(readPsdHeader(header(1, 5000, 100, 3)).ok).toBe(false);
    expect(readPsdHeader(header(1, 100, 100, 9)).ok).toBe(false);
    expect(readPsdHeader(new Uint8Array(4)).ok).toBe(false);
  });
});

describe("psdToDesign", () => {
  it("keeps order, names, visibility, opacity, blend mode and position", () => {
    const psd: Psd = {
      width: 200,
      height: 200,
      children: [
        solid("Fundo", 0, 0, 200),
        solid("Foto", 20, 30, 50, {
          hidden: true,
          opacity: 0.5,
          fillOpacity: 0.25,
          blendMode: "multiply",
        }),
      ],
    };
    const result = psdToDesign(psd, { newId: counter() });
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
    const psd: Psd = {
      width: 100,
      height: 100,
      children: [
        { name: "Grupo", opacity: 0.8, children: [solid("Dentro", 0, 0, 10)] },
        { name: "Vazio", children: [] },
      ],
    };
    const result = psdToDesign(psd, { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [group, child] = result.design.elements;
    expect(result.design.elements).toHaveLength(2);
    expect(group).toMatchObject({ kind: DesignElementKind.Group, opacity: 0.8 });
    expect(child?.parentId).toBe(group?.id);
  });

  it("crops layers to the canvas and skips layers fully outside it", () => {
    const psd: Psd = {
      width: 100,
      height: 100,
      children: [solid("Sangrando", 80, 80, 50), solid("Fora", 300, 300, 10)],
    };
    const result = psdToDesign(psd, { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.elements).toHaveLength(1);
    expect(result.design.elements[0]).toMatchObject({ x: 80, y: 80, width: 20, height: 20 });
  });

  it("bakes an enabled layer mask into the alpha", () => {
    const mask = {
      left: 0,
      top: 0,
      right: 10,
      bottom: 10,
      defaultColor: 0,
      imageData: pixels(10, 5, [255, 255, 255, 255]),
    };
    const psd: Psd = { width: 64, height: 64, children: [solid("Mascarada", 0, 0, 10, { mask })] };
    const result = psdToDesign(psd, { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const buffer = [...result.design.buffers.values()][0];
    expect(buffer?.data[3]).toBe(255);
    expect(buffer?.data[9 * 10 * 4 + 3]).toBe(0);
  });

  it("notes text, effects, adjustments and unsupported blend modes", () => {
    const psd: Psd = {
      width: 64,
      height: 64,
      children: [
        solid("Texto", 0, 0, 10, { text: { text: "Oi" } }),
        solid("Sombra", 0, 0, 10, { effects: {}, blendMode: "vivid light" }),
        { name: "Curvas", adjustment: { type: "curves" } },
      ],
    };
    const result = psdToDesign(psd, { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.elements).toHaveLength(2);
    expect(result.design.notes).toHaveLength(4);
  });

  it("falls back to the composite image of a flat file", () => {
    const psd: Psd = { width: 64, height: 64, imageData: pixels(64, 64, [1, 2, 3, 255]) };
    const result = psdToDesign(psd, { newId: counter() });
    expect(result.ok && result.design.elements).toHaveLength(1);
  });

  it("refuses a file without pixels and a file over the memory budget", () => {
    const empty = psdToDesign({ width: 64, height: 64, children: [] }, { newId: counter() });
    expect(!empty.ok && empty.message).toBe(DESIGN_IMPORT_MESSAGE.noLayers);
    const big = psdToDesign(
      { width: 100, height: 100, children: [solid("A", 0, 0, 100)] },
      { newId: counter(), budgetBytes: 1000 },
    );
    expect(!big.ok && big.message).toBe(DESIGN_IMPORT_MESSAGE.memory);
  });

  it("clips a layer only above a pixel layer", () => {
    const psd: Psd = {
      width: 64,
      height: 64,
      children: [
        solid("Base", 0, 0, 10),
        solid("Cortada", 0, 0, 10, { clipping: true }),
        { name: "Grupo", children: [solid("Solta", 0, 0, 10, { clipping: true })] },
      ],
    };
    const result = psdToDesign(psd, { newId: counter() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const clips = result.design.elements.map((element) => element.clipToBelow);
    expect(clips).toEqual([false, true, false, false]);
  });
});
