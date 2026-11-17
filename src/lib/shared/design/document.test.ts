import { describe, expect, it } from "vitest";
import {
  addElement,
  addPage,
  canAddElements,
  coverCrop,
  createImage,
  createLine,
  createShape,
  createText,
  documentBytes,
  duplicateElements,
  duplicatePage,
  emptyDocument,
  emptyPage,
  expandSelection,
  groupElements,
  imageVersionIds,
  isTooLarge,
  moveLayer,
  movePage,
  normalizeColor,
  patchElement,
  patchImage,
  patchShape,
  patchText,
  removeElements,
  removePage,
  resizeDocument,
  rgbToHex,
  snapBox,
  snapTargets,
  ungroupElements,
  updatePage,
} from "@/lib/shared/design/document";
import { historyOf, pushHistory, redoHistory, undoHistory } from "@/lib/shared/design/history";
import {
  type DesignDocument,
  type DesignPage,
  designDocumentSchema,
  designDocumentV2Schema,
} from "@/lib/shared/design/schemas";
import {
  DESIGN_LIMITS,
  DesignElementKind,
  DesignPreset,
  LayerMove,
} from "@/lib/shared/design/types";

const palette = {
  ink: rgbToHex(20, 36, 92),
  surface: rgbToHex(255, 253, 254),
  accent: rgbToHex(91, 51, 176),
};
const mediaId = "6f1c1a52-6b2e-4e44-9a4e-2f4b9b3c1a10";

const samplePage = (): DesignPage => {
  const withText = addElement(emptyPage("p1"), createText("t1", DesignPreset.FeedSquare, palette));
  const withRect = addElement(
    withText,
    createShape("r1", DesignElementKind.Rect, DesignPreset.FeedSquare, palette),
  );
  return addElement(
    withRect,
    createImage("i1", DesignPreset.FeedSquare, mediaId, { width: 4000, height: 2000 }),
  );
};

const sample = (): DesignDocument => ({ version: 2, pages: [samplePage()] });

const ids = (page: DesignPage | undefined) => page?.elements.map((element) => element.id) ?? [];

let counter = 0;
const nextId = () => {
  counter += 1;
  return `n${counter}`;
};

describe("design colors", () => {
  it("converts channels to lowercase #rrggbb and clamps them", () => {
    expect(rgbToHex(0, 128, 300)).toBe(rgbToHex(0, 128, 255));
    expect(rgbToHex(20, 36, 92)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("normalizes short hex, uppercase hex and rgb() into one form", () => {
    const expected = rgbToHex(170, 187, 204);
    expect(normalizeColor(` ${expected.toUpperCase()} `)).toBe(expected);
    expect(normalizeColor("rgb(170, 187, 204)")).toBe(expected);
    expect(normalizeColor(`#${"abc"}`)).toBe(expected);
    expect(normalizeColor("oklch(0.5 0.1 200)")).toBeNull();
  });
});

describe("design document", () => {
  it("creates elements centered on the page and valid for the schema", () => {
    const document = sample();
    const text = document.pages[0]?.elements[0];
    expect(text?.x).toBe(Math.round((1080 - (text?.width ?? 0)) / 2));
    const withLine = updatePage(document, "p1", (page) =>
      addElement(page, createLine("l1", DesignPreset.FeedSquare, palette)),
    );
    expect(designDocumentV2Schema.safeParse(withLine).success).toBe(true);
  });

  it("reads a version 1 document as one page with the new defaults", () => {
    const parsed = designDocumentSchema.parse({
      version: 1,
      background: null,
      elements: [
        {
          id: "i",
          kind: DesignElementKind.Image,
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          rotation: 0,
          opacity: 1,
          locked: false,
          mediaVersionId: mediaId,
          flipX: false,
          flipY: false,
        },
      ],
    });
    expect(parsed.version).toBe(2);
    expect(parsed.pages).toHaveLength(1);
    expect(parsed.pages[0]?.elements[0]).toMatchObject({ groupId: null, zoom: 1, alt: "" });
  });

  it("fits a large image inside 80% of the page keeping its ratio", () => {
    const image = createImage("i", DesignPreset.FeedSquare, mediaId, { width: 4000, height: 2000 });
    expect(image.width).toBe(864);
    expect(image.height).toBe(432);
  });

  it("covers a frame with the image, honoring zoom and focus", () => {
    const natural = { width: 2000, height: 1000 };
    expect(coverCrop(natural, { width: 100, height: 100 }, 1, 0.5, 0.5)).toEqual({
      x: 500,
      y: 0,
      width: 1000,
      height: 1000,
    });
    expect(coverCrop(natural, { width: 100, height: 100 }, 2, 0, 1)).toEqual({
      x: 0,
      y: 500,
      width: 500,
      height: 500,
    });
  });

  it("clamps sizes, opacity, font size and zoom", () => {
    const page = patchImage(
      patchText(patchElement(samplePage(), "t1", { width: 0, opacity: 2 }), "t1", {
        fontSize: 9999,
      }),
      "i1",
      { zoom: 9 },
    );
    const [text, , image] = page.elements;
    expect(text?.width).toBe(DESIGN_LIMITS.minSize);
    expect(text?.opacity).toBe(1);
    expect(text?.kind === DesignElementKind.Text ? text.fontSize : 0).toBe(
      DESIGN_LIMITS.maxFontSize,
    );
    expect(image?.kind === DesignElementKind.Image ? image.zoom : 0).toBe(DESIGN_LIMITS.maxZoom);
  });

  it("applies kind patches only to the matching kind", () => {
    const page = patchShape(samplePage(), "t1", { fill: palette.ink });
    expect(page.elements[0]).toEqual(samplePage().elements[0]);
  });

  it("reorders layers and ignores moves past the ends", () => {
    const page = samplePage();
    expect(ids(moveLayer(page, "t1", LayerMove.Top))).toEqual(["r1", "i1", "t1"]);
    expect(ids(moveLayer(page, "i1", LayerMove.Bottom))).toEqual(["i1", "t1", "r1"]);
    expect(ids(moveLayer(page, "t1", LayerMove.Up))).toEqual(["r1", "t1", "i1"]);
    expect(moveLayer(page, "t1", LayerMove.Down)).toBe(page);
  });

  it("duplicates a selection on top, unlocked, offset and with a new group id", () => {
    const grouped = groupElements(
      patchElement(samplePage(), "r1", { locked: true }),
      ["t1", "r1"],
      "g1",
    );
    const result = duplicateElements(grouped, ["t1", "r1"], nextId);
    expect(result.page.elements).toHaveLength(5);
    const copies = result.page.elements.slice(3);
    expect(copies.every((copy) => !copy.locked)).toBe(true);
    expect(copies[0]?.groupId).toBe(copies[1]?.groupId);
    expect(copies[0]?.groupId).not.toBe("g1");
    expect(copies[0]?.x).toBe((grouped.elements[0]?.x ?? 0) + DESIGN_LIMITS.duplicateOffset);
  });

  it("selects the whole group and ungroups it", () => {
    const grouped = groupElements(samplePage(), ["t1", "r1"], "g1");
    expect(expandSelection(grouped, ["r1"])).toEqual(["t1", "r1"]);
    expect(expandSelection(ungroupElements(grouped, ["t1", "r1"]), ["r1"])).toEqual(["r1"]);
    expect(groupElements(samplePage(), ["t1"], "g2")).toEqual(samplePage());
  });

  it("removes elements and lists referenced images once across pages", () => {
    const document = duplicatePage(sample(), "p1", "p2", nextId);
    expect(document.pages).toHaveLength(2);
    expect(imageVersionIds(document)).toEqual([mediaId]);
    expect(ids(removeElements(samplePage(), ["i1", "t1"]))).toEqual(["r1"]);
  });

  it("adds, moves and removes pages but keeps at least one", () => {
    let document = addPage(sample(), "p1", emptyPage("p2"));
    document = movePage(document, "p2", -1);
    expect(document.pages.map((page) => page.id)).toEqual(["p2", "p1"]);
    expect(movePage(document, "p2", -1)).toBe(document);
    document = removePage(removePage(document, "p2"), "p1");
    expect(document.pages.map((page) => page.id)).toEqual(["p1"]);
  });

  it("stops at the page and element limits", () => {
    let document = emptyDocument();
    for (let index = 2; index <= DESIGN_LIMITS.maxPages + 3; index += 1) {
      document = addPage(document, "page-1", emptyPage(`p${index}`));
    }
    expect(document.pages).toHaveLength(DESIGN_LIMITS.maxPages);
    const full: DesignDocument = {
      version: 2,
      pages: [
        {
          id: "f",
          background: null,
          elements: Array.from({ length: DESIGN_LIMITS.maxElements }, (_, index) =>
            createShape(`e${index}`, DesignElementKind.Ellipse, DesignPreset.Story, palette),
          ),
        },
      ],
    };
    expect(canAddElements(full)).toBe(false);
    expect(designDocumentV2Schema.safeParse(full).success).toBe(true);
  });

  it("measures the document size in bytes", () => {
    const document = updatePage(sample(), "p1", (page) =>
      patchText(page, "t1", { text: "ção".repeat(10) }),
    );
    expect(documentBytes(document)).toBe(new TextEncoder().encode(JSON.stringify(document)).length);
    expect(isTooLarge(document)).toBe(false);
  });

  it("refuses duplicated ids and unknown kinds", () => {
    const page = samplePage();
    const duplicated = {
      version: 2,
      pages: [{ ...page, elements: [...page.elements, page.elements[0]] }],
    };
    expect(designDocumentV2Schema.safeParse(duplicated).success).toBe(false);
    const unknown = {
      version: 2,
      pages: [{ ...page, elements: [{ ...page.elements[1], kind: "video" }] }],
    };
    expect(designDocumentV2Schema.safeParse(unknown).success).toBe(false);
  });

  it("resizes a square design into a story, scaled and centered", () => {
    const resized = resizeDocument(sample(), DesignPreset.FeedSquare, DesignPreset.Story);
    const rect = resized.pages[0]?.elements[1];
    const source = sample().pages[0]?.elements[1];
    expect(rect?.width).toBe(source?.width);
    expect(rect?.y).toBe((source?.y ?? 0) + (1920 - 1080) / 2);
    const smaller = resizeDocument(sample(), DesignPreset.Story, DesignPreset.FeedSquare);
    const text = smaller.pages[0]?.elements[0];
    expect(text?.kind === DesignElementKind.Text ? text.fontSize : 0).toBe(Math.round(72 * 0.5625));
  });
});

describe("design snapping", () => {
  const page = samplePage();
  const size = { width: 1080, height: 1080 };

  it("snaps the center of a box to the center of the page", () => {
    const result = snapBox(
      { x: 437, y: 10, width: 200, height: 50 },
      snapTargets(page, size, ["t1", "r1", "i1"]),
      6,
    );
    expect(result.dx).toBe(3);
    expect(result.guidesX).toEqual([540]);
  });

  it("does not snap when nothing is close enough", () => {
    const result = snapBox(
      { x: 100, y: 100, width: 50, height: 50 },
      { xs: [0, 1080], ys: [0, 1080] },
      6,
    );
    expect(result).toEqual({ dx: 0, dy: 0, guidesX: [], guidesY: [] });
  });
});

describe("design history", () => {
  it("undoes and redoes, and a new change clears the redo stack", () => {
    let history = historyOf(1);
    history = pushHistory(history, 2, 100);
    history = pushHistory(history, 3, 100);
    history = undoHistory(history);
    expect(history.present).toBe(2);
    history = redoHistory(history);
    expect(history.present).toBe(3);
    history = pushHistory(undoHistory(history), 9, 100);
    expect(history.future).toEqual([]);
    expect(redoHistory(history)).toBe(history);
  });

  it("merges consecutive changes with the same key into one step", () => {
    let history = historyOf("");
    history = pushHistory(history, "a", 100, "text:t1");
    history = pushHistory(history, "ab", 100, "text:t1");
    history = pushHistory(history, "abc", 100, "text:t1");
    expect(history.past).toEqual([""]);
    expect(undoHistory(history).present).toBe("");
  });

  it("keeps at most the limit of past steps", () => {
    let history = historyOf(0);
    for (let step = 1; step <= 10; step += 1) history = pushHistory(history, step, 3);
    expect(history.past).toEqual([7, 8, 9]);
  });
});
