import { describe, expect, it } from "vitest";
import {
  addElement,
  createShape,
  createText,
  emptyPage,
  patchElement,
  rgbToHex,
} from "@/lib/shared/design/document";
import { dropTargetIndex, layerLabel, moveLayerTo } from "@/lib/shared/design/layers";
import { DesignElementKind, DesignPreset } from "@/lib/shared/design/types";

const palette = {
  ink: rgbToHex(20, 36, 92),
  surface: rgbToHex(255, 253, 254),
  accent: rgbToHex(91, 51, 176),
};

const three = () => {
  let page = emptyPage("p1");
  page = addElement(
    page,
    createShape("a", DesignElementKind.Rect, DesignPreset.FeedSquare, palette),
  );
  page = addElement(
    page,
    createShape("b", DesignElementKind.Ellipse, DesignPreset.FeedSquare, palette),
  );
  return addElement(page, createText("c", DesignPreset.FeedSquare, palette));
};

const ids = (page: ReturnType<typeof three>) => page.elements.map((element) => element.id);

describe("moveLayerTo", () => {
  it("moves a layer to an index and keeps the others in order", () => {
    expect(ids(moveLayerTo(three(), "a", 2))).toEqual(["b", "c", "a"]);
    expect(ids(moveLayerTo(three(), "c", 0))).toEqual(["c", "a", "b"]);
  });

  it("clamps the target and ignores unknown ids", () => {
    expect(ids(moveLayerTo(three(), "a", 99))).toEqual(["b", "c", "a"]);
    expect(ids(moveLayerTo(three(), "a", -4))).toEqual(["a", "b", "c"]);
    const page = three();
    expect(moveLayerTo(page, "zzz", 1)).toBe(page);
    expect(moveLayerTo(page, "a", 0)).toBe(page);
  });
});

describe("layer labels", () => {
  it("uses the own name, then the kind and a snippet", () => {
    const page = three();
    expect(page.elements.map(layerLabel)[0]).toBe("Retângulo");
    const named = patchElement(page, "a", { name: "  Fundo  " });
    expect(named.elements.map(layerLabel)[0]).toBe("Fundo");
    const cleared = patchElement(named, "a", { name: "" });
    expect(cleared.elements.map(layerLabel)[0]).toBe("Retângulo");
  });

  it("hides and shows through a patch", () => {
    const hidden = patchElement(three(), "b", { hidden: true });
    expect(hidden.elements[1]?.hidden).toBe(true);
    expect(patchElement(hidden, "b", { hidden: false }).elements[1]?.hidden).toBe(false);
  });
});

describe("dropTargetIndex", () => {
  it("maps an insertion line of the front-first list to an array index", () => {
    expect(dropTargetIndex(3, 2, 0)).toBe(2);
    expect(dropTargetIndex(3, 0, 3)).toBe(0);
    expect(dropTargetIndex(3, 0, 1)).toBe(2);
    expect(dropTargetIndex(3, 1, 2)).toBe(1);
  });
});
