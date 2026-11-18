import { describe, expect, it } from "vitest";
import {
  LayerMaskKind,
  buildMaskBuffer,
  coverageOfPlaced,
  grayOf,
  isMaskKey,
  maskKey,
  maskValueAt,
  ownerIdOfKey,
} from "@/lib/shared/design/layer-mask";
import { createPixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";

const selection = { width: 2, height: 1, data: new Uint8Array([255, 40]) };

describe("layer mask keys", () => {
  it("round-trips the owner id", () => {
    expect(isMaskKey(maskKey("abc"))).toBe(true);
    expect(isMaskKey("abc")).toBe(false);
    expect(ownerIdOfKey(maskKey("abc"))).toBe("abc");
    expect(ownerIdOfKey("abc")).toBe("abc");
  });
});

describe("buildMaskBuffer", () => {
  it("reveals everything with white and hides everything with black", () => {
    expect(maskValueAt(buildMaskBuffer(LayerMaskKind.RevealAll, 2, 1, null), 1, 0)).toBe(255);
    expect(maskValueAt(buildMaskBuffer(LayerMaskKind.HideAll, 2, 1, null), 1, 0)).toBe(0);
  });

  it("reveals the selection and hides the rest", () => {
    const buffer = buildMaskBuffer(LayerMaskKind.RevealSelection, 2, 1, selection);
    expect([maskValueAt(buffer, 0, 0), maskValueAt(buffer, 1, 0)]).toEqual([255, 40]);
    expect(buffer.data[3]).toBe(255);
  });

  it("hides the selection and reveals the rest", () => {
    const buffer = buildMaskBuffer(LayerMaskKind.HideSelection, 2, 1, selection);
    expect([maskValueAt(buffer, 0, 0), maskValueAt(buffer, 1, 0)]).toEqual([0, 215]);
  });

  it("treats a missing selection as nothing selected", () => {
    const buffer = buildMaskBuffer(LayerMaskKind.RevealSelection, 2, 1, null);
    expect(maskValueAt(buffer, 0, 0)).toBe(0);
  });
});

describe("coverageOfPlaced", () => {
  it("multiplies gray by alpha and is zero outside the layer", () => {
    const placed = createPixelBuffer(2, 1);
    placed.data.set([200, 200, 200, 255, 200, 200, 200, 0]);
    expect(Array.from(coverageOfPlaced(placed).data)).toEqual([200, 0]);
  });
});

describe("grayOf", () => {
  it("maps white and black and weights green highest", () => {
    expect(grayOf({ r: 255, g: 255, b: 255 })).toBe(255);
    expect(grayOf({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(grayOf({ r: 0, g: 255, b: 0 })).toBeGreaterThan(grayOf({ r: 255, g: 0, b: 0 }));
  });
});
