import { describe, expect, it } from "vitest";
import {
  alignElements,
  alignsToPage,
  canDistribute,
  centerAt,
  drawnElement,
  distributeElements,
  lineBetween,
  placeInBox,
  selectAll,
  selectInBox,
  transformSelection,
} from "@/lib/shared/design/arrange";
import {
  addElement,
  createLine,
  createShape,
  createText,
  emptyPage,
  groupElements,
  patchElement,
  rgbToHex,
} from "@/lib/shared/design/document";
import type { DesignElement, DesignPage } from "@/lib/shared/design/schemas";
import {
  DesignAlign,
  DesignDistribute,
  DesignElementKind,
  DesignPreset,
  DesignTool,
} from "@/lib/shared/design/types";

const palette = {
  ink: rgbToHex(20, 36, 92),
  surface: rgbToHex(255, 253, 254),
  accent: rgbToHex(91, 51, 176),
};
const page = { width: 1080, height: 1080 };

const rect = (id: string, x: number, y: number, width = 100, height = 100): DesignElement => ({
  ...createShape(id, DesignElementKind.Rect, DesignPreset.FeedSquare, palette),
  x,
  y,
  width,
  height,
});

const pageOf = (...elements: DesignElement[]): DesignPage =>
  elements.reduce((current, element) => addElement(current, element), emptyPage("p1"));

const at = (current: DesignPage, id: string) =>
  current.elements.find((element) => element.id === id);

describe("design align", () => {
  it("aligns one element to the page", () => {
    const result = alignElements(pageOf(rect("a", 10, 20)), ["a"], DesignAlign.CenterX, page);
    expect(at(result, "a")?.x).toBe(490);
    expect(alignsToPage(result, ["a"])).toBe(true);
  });

  it("aligns several elements to the selection bounds", () => {
    const current = pageOf(rect("a", 10, 0), rect("b", 300, 0, 200));
    const result = alignElements(current, ["a", "b"], DesignAlign.Right, page);
    expect(at(result, "a")?.x).toBe(400);
    expect(at(result, "b")?.x).toBe(300);
  });

  it("moves a group as one unit and aligns it to the page", () => {
    const grouped = groupElements(pageOf(rect("a", 0, 0), rect("b", 200, 0)), ["a", "b"], "g");
    const result = alignElements(grouped, ["a", "b"], DesignAlign.Bottom, page);
    expect(at(result, "a")?.y).toBe(980);
    expect(at(result, "b")?.y).toBe(980);
    expect(at(result, "b")?.x).toBe(200);
  });

  it("leaves locked elements where they are", () => {
    const current = patchElement(pageOf(rect("a", 0, 0)), "a", { locked: true });
    expect(alignElements(current, ["a"], DesignAlign.Right, page)).toEqual(current);
  });
});

describe("design distribute", () => {
  it("leaves equal gaps between three elements", () => {
    const current = pageOf(rect("a", 0, 0), rect("c", 900, 0), rect("b", 150, 0));
    expect(canDistribute(current, ["a", "b", "c"])).toBe(true);
    const result = distributeElements(current, ["a", "b", "c"], DesignDistribute.Horizontal);
    expect(at(result, "a")?.x).toBe(0);
    expect(at(result, "b")?.x).toBe(450);
    expect(at(result, "c")?.x).toBe(900);
  });

  it("needs three units", () => {
    const current = pageOf(rect("a", 0, 0), rect("b", 500, 0));
    expect(canDistribute(current, ["a", "b"])).toBe(false);
    expect(distributeElements(current, ["a", "b"], DesignDistribute.Vertical)).toEqual(current);
  });
});

describe("design selection transform", () => {
  it("scales several elements into a new box", () => {
    const current = pageOf(rect("a", 0, 0), rect("b", 100, 100));
    const result = transformSelection(current, ["a", "b"], {
      x: 10,
      y: 10,
      width: 400,
      height: 200,
    });
    expect(at(result, "a")).toMatchObject({ x: 10, y: 10, width: 200, height: 100 });
    expect(at(result, "b")).toMatchObject({ x: 210, y: 110, width: 200, height: 100 });
  });

  it("keeps the measured height of a text", () => {
    const text = { ...createText("t", DesignPreset.FeedSquare, palette), x: 0, y: 0, width: 100 };
    const result = transformSelection(pageOf(text), ["t"], { x: 0, y: 0, width: 300, height: 999 });
    expect(at(result, "t")?.width).toBe(300);
    expect(at(result, "t")?.height).toBe(text.height);
  });
});

describe("design marquee and placement", () => {
  it("selects the unlocked elements that touch the box, with their groups", () => {
    const grouped = groupElements(
      pageOf(rect("a", 0, 0), rect("b", 600, 600), rect("c", 50, 50)),
      ["a", "b"],
      "g",
    );
    const locked = patchElement(grouped, "c", { locked: true });
    expect(selectInBox(locked, { x: 0, y: 0, width: 40, height: 40 })).toEqual(["a", "b"]);
    expect(selectAll(locked)).toEqual(["a", "b"]);
  });

  it("places a shape in a drawn box and centers a default one on a click", () => {
    const shape = rect("a", 0, 0);
    expect(placeInBox(shape, { x: 5, y: 6, width: 0, height: 40 })).toMatchObject({
      x: 5,
      y: 6,
      width: 1,
      height: 40,
    });
    expect(centerAt(shape, { x: 500, y: 500 })).toMatchObject({ x: 450, y: 450 });
  });

  it("draws a line between two points", () => {
    const line = createLine("l", DesignPreset.FeedSquare, palette);
    const result = lineBetween(line, { x: 0, y: 0 }, { x: 100, y: 100 });
    expect(result.width).toBe(141);
    expect(result.rotation).toBe(45);
    expect(Math.abs(result.x + result.width / 2 - 50)).toBeLessThanOrEqual(1);
  });
});

describe("design drawing", () => {
  it("creates a rectangle in the drawn box and a default text centered on a click", () => {
    const spec = { id: "n", preset: DesignPreset.FeedSquare, palette, shift: false };
    const drawn = drawnElement({
      ...spec,
      tool: DesignTool.Rect,
      start: { x: 100, y: 100 },
      end: { x: 40, y: 300 },
    });
    expect(drawn).toMatchObject({
      kind: DesignElementKind.Rect,
      x: 40,
      y: 100,
      width: 60,
      height: 200,
    });
    const text = drawnElement({
      ...spec,
      tool: DesignTool.Text,
      start: { x: 540, y: 540 },
      end: null,
    });
    expect(text.kind).toBe(DesignElementKind.Text);
    expect(text.x + text.width / 2).toBe(540);
  });
});
