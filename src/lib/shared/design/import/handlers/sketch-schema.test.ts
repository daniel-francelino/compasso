import { describe, expect, it } from "vitest";
import {
  SketchNodeKind,
  flattenLayers,
  listArtboards,
  newJsonValueBudget,
  parseSketchDocument,
  parseSketchJson,
  parseSketchMeta,
  readArtboard,
  readSketchPages,
} from "@/lib/shared/design/import/handlers/sketch-schema";
import { SKETCH_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);
const json = (value: unknown): Uint8Array => bytes(JSON.stringify(value));
const messageOf = (result: { ok: boolean; message?: string }): string | null =>
  result.ok ? null : (result.message ?? null);

const frame = { x: 1, y: 2, width: 30, height: 40 };
const red = { red: 1, green: 0, blue: 0, alpha: 1 };
const rectangle = (name: string, extra: Record<string, unknown> = {}) => ({
  _class: "rectangle",
  do_objectID: name,
  name,
  frame,
  fixedRadius: 4,
  style: { fills: [{ isEnabled: true, fillType: 0, color: red }] },
  ...extra,
});
const artboard = (name: string, layers: unknown[]) => ({
  _class: "artboard",
  do_objectID: name,
  name,
  frame: { x: 0, y: 0, width: 200, height: 100 },
  layers,
});
const pageOf = (...artboards: unknown[]) => ({ _class: "page", layers: artboards });

const nestedArrays = (levels: number): string => "[".repeat(levels) + "]".repeat(levels);
const group = (layers: unknown[]) => ({ _class: "group", name: "g", frame, layers });
const artboardOf = (layers: unknown[]) => {
  const pages = read(pageOf(artboard("A", layers)));
  const info = listArtboards(pages).listed[0];
  if (info === undefined) throw new Error("no artboard");
  return readArtboard(pages, info);
};

const read = (value: unknown) => {
  const pages = readSketchPages([value]);
  if (!pages.ok) throw new Error("page refused");
  return pages.pages;
};

describe("parseSketchJson", () => {
  it("parses plain JSON", () => {
    const parsed = parseSketchJson(json({ a: [1, 2] }));
    expect(parsed.ok && parsed.value).toEqual({ a: [1, 2] });
  });

  it("refuses invalid UTF-8, malformed JSON and a __proto__ key", () => {
    expect(parseSketchJson(new Uint8Array([0xff, 0xfe, 0x7b])).ok).toBe(false);
    expect(parseSketchJson(bytes("{ not json")).ok).toBe(false);
    expect(parseSketchJson(bytes('{"a":{"__proto__":{"x":1}}}')).ok).toBe(false);
  });

  it("refuses 100000-deep nesting without a stack overflow", () => {
    const deep = "[".repeat(100000) + "]".repeat(100000);
    expect(messageOf(parseSketchJson(bytes(deep)))).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
    const objects = '{"a":'.repeat(100000) + "1" + "}".repeat(100000);
    expect(parseSketchJson(bytes(objects)).ok).toBe(false);
  });

  it("accepts nesting at the depth limit and refuses one level more", () => {
    const limit = SKETCH_LIMITS.maxJsonDepth;
    expect(parseSketchJson(bytes(nestedArrays(limit))).ok).toBe(true);
    expect(messageOf(parseSketchJson(bytes(nestedArrays(limit + 1))))).toBe(
      DESIGN_IMPORT_MESSAGE.sketchCorrupt,
    );
  });

  it("keeps string state across escaped quotes and escaped backslashes", () => {
    const quoted = JSON.stringify({ s: '"' + "[".repeat(300) });
    expect(parseSketchJson(bytes(quoted)).ok).toBe(true);
    const slashed = JSON.stringify({
      s: String.fromCharCode(92),
      d: JSON.parse(nestedArrays(129)),
    });
    expect(slashed).toContain(String.fromCharCode(92, 92));
    expect(parseSketchJson(bytes(slashed)).ok).toBe(false);
  });

  it("accepts exactly the maximum number of JSON values and refuses one more", () => {
    const body = (count: number): Uint8Array => bytes("[" + "0,".repeat(count - 1) + "0]");
    const limit = SKETCH_LIMITS.maxJsonValues;
    expect(parseSketchJson(body(limit - 1)).ok).toBe(true);
    expect(messageOf(parseSketchJson(body(limit)))).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
  }, 60_000);

  it("charges the values of every parse to a shared job budget", () => {
    const budget = { remaining: 7 };
    expect(parseSketchJson(json([1, 2, 3]), budget).ok).toBe(true);
    expect(budget.remaining).toBe(3);
    expect(messageOf(parseSketchJson(json([1, 2, 3]), budget))).toBe(
      DESIGN_IMPORT_MESSAGE.sketchCorrupt,
    );
    expect(newJsonValueBudget().remaining).toBe(SKETCH_LIMITS.maxJobJsonValues);
  });

  it("does not count brackets inside strings as depth", () => {
    const text = JSON.stringify({ s: "[".repeat(500) });
    expect(parseSketchJson(bytes(text)).ok).toBe(true);
  });
});

describe("meta and document", () => {
  it("accepts a supported version and refuses an old or malformed one", () => {
    expect(parseSketchMeta({ version: 136 }).ok).toBe(true);
    expect(messageOf(parseSketchMeta({ version: 10 }))).toBe(
      DESIGN_IMPORT_MESSAGE.sketchUnsupportedVersion,
    );
    expect(messageOf(parseSketchMeta({ version: "x" }))).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
    expect(parseSketchMeta({ version: Infinity }).ok).toBe(false);
  });

  it("maps page references to entry names and refuses traversal references", () => {
    const good = parseSketchDocument({ pages: [{ _ref: "pages/ABC-1" }] });
    expect(good.ok && good.pageEntries).toEqual(["pages/ABC-1.json"]);
    expect(parseSketchDocument({ pages: [{ _ref: "pages/../x" }] }).ok).toBe(false);
    expect(parseSketchDocument({ pages: [{ _ref: "/etc/passwd" }] }).ok).toBe(false);
    expect(parseSketchDocument({ pages: [] }).ok).toBe(false);
  });
});

describe("artboards and layers", () => {
  it("lists three artboards and keeps layer names and order", () => {
    const pages = read(
      pageOf(
        artboard("One", [rectangle("a"), rectangle("b")]),
        artboard("Two", []),
        artboard("Three", []),
      ),
    );
    const listed = listArtboards(pages);
    expect(listed.listed.map((entry) => entry.name)).toEqual(["One", "Two", "Three"]);
    const first = listed.listed[0];
    if (first === undefined) throw new Error("no artboard");
    const result = readArtboard(pages, first);
    expect(result.ok && result.artboard.nodes.map((node) => node.name)).toEqual(["a", "b"]);
  });

  it("caps the listing at 100 artboards but reports the total", () => {
    const many = Array.from({ length: 130 }, (_, index) => artboard(`n${index}`, []));
    const listed = listArtboards(read(pageOf(...many)));
    expect(listed.listed).toHaveLength(100);
    expect(listed.total).toBe(130);
  });

  it("walks nested groups with depth, iteratively", () => {
    let layer: unknown = rectangle("leaf");
    for (let level = 0; level < 100; level += 1) {
      layer = { _class: "group", name: `g${level}`, frame, layers: [layer] };
    }
    const pages = read(pageOf(artboard("A", [layer])));
    const info = listArtboards(pages).listed[0];
    if (info === undefined) throw new Error("no artboard");
    const result = readArtboard(pages, info);
    expect(result.ok && result.artboard.nodes).toHaveLength(101);
    expect(result.ok && result.artboard.nodes.at(-1)?.depth).toBe(100);
    expect(result.ok && result.artboard.deepGroups).toBe(92);
  });

  it("keeps unknown classes as unsupported nodes with only identity and frame", () => {
    const pages = read(
      pageOf(artboard("A", [{ _class: "hotspot", name: "h", frame, secret: { deep: [1] } }])),
    );
    const info = listArtboards(pages).listed[0];
    if (info === undefined) throw new Error("no artboard");
    const result = readArtboard(pages, info);
    expect(result.ok && result.artboard.nodes[0]?.kind).toBe(SketchNodeKind.Unsupported);
  });

  it("reads fills, dropped styles, bitmap refs and path points", () => {
    const styled = rectangle("s", {
      style: {
        fills: [{ isEnabled: true, fillType: 0, color: red }],
        borders: [{ isEnabled: true }],
        shadows: [{ isEnabled: true }, { isEnabled: false }],
      },
    });
    const bitmap = {
      _class: "bitmap",
      name: "b",
      frame,
      image: { _class: "MSJSONFileReference", _ref: "images/abc.png" },
    };
    const traversal = { ...bitmap, name: "t", image: { _ref: "images/../../x" } };
    const path = {
      _class: "shapePath",
      name: "p",
      frame,
      points: [{ point: "{0, 0}" }, { point: "{1, 0}" }, { point: "{0.5, 1}" }],
      style: { fills: [{ isEnabled: true, fillType: 0, color: red }] },
    };
    const pages = read(pageOf(artboard("A", [styled, bitmap, traversal, path])));
    const info = listArtboards(pages).listed[0];
    if (info === undefined) throw new Error("no artboard");
    const result = readArtboard(pages, info);
    if (!result.ok) throw new Error("expected nodes");
    const [rect, image, bad, shape] = result.artboard.nodes;
    expect(rect?.fill).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(rect?.droppedStyles).toBe(2);
    expect(image?.imageRef).toBe("images/abc.png");
    expect(bad?.imageRef).toBeNull();
    expect(shape?.points).toHaveLength(3);
  });

  it("refuses a supported layer that fails the schema, with no partial import", () => {
    const hostile = [
      rectangle("nan", { frame: { x: 0, y: 0, width: Infinity, height: 1 } }),
      rectangle("negative", { frame: { x: 0, y: 0, width: -5, height: 1 } }),
      rectangle("huge", { frame: { x: 1e12, y: 0, width: 1, height: 1 } }),
      rectangle("long", { name: "x".repeat(5000) }),
      { _class: "shapePath", name: "p", frame, points: [{ point: "garbage" }] },
    ];
    for (const layer of hostile) {
      const pages = read(pageOf(artboard("A", [rectangle("ok"), layer])));
      const info = listArtboards(pages).listed[0];
      if (info === undefined) throw new Error("no artboard");
      expect(messageOf(readArtboard(pages, info))).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
    }
  });

  it("refuses a children array above the schema cap as corrupt", () => {
    const layers = Array.from({ length: 5001 }, (_, index) => rectangle(`r${index}`));
    const unlisted = read(pageOf(artboard("A", layers)));
    expect(listArtboards(unlisted).total).toBe(0);
    expect(messageOf(artboardOf([group(layers)]))).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
  });

  it("accepts exactly 5000 nodes per artboard and refuses 5001 with the layer limit", () => {
    const rects = (count: number) => Array.from({ length: count }, (_, i) => rectangle(`r${i}`));
    const atCap = artboardOf([group(rects(4999))]);
    expect(atCap.ok && atCap.artboard.nodes).toHaveLength(5000);
    const over = artboardOf([group(rects(5000))]);
    expect(messageOf(over)).toBe(DESIGN_IMPORT_MESSAGE.tooManyLayers(DESIGN_LIMITS.maxElements));
    const spread = artboardOf([group(rects(3000)), group(rects(3000))]);
    expect(messageOf(spread)).toBe(DESIGN_IMPORT_MESSAGE.tooManyLayers(DESIGN_LIMITS.maxElements));
  });

  it("flattens a chain deeper than a recursive walk could survive", () => {
    const levels = 4990;
    let layer: unknown = rectangle("leaf");
    for (let level = 0; level < levels; level += 1) layer = group([layer]);
    const result = flattenLayers([layer]);
    if (!result.ok) throw new Error("expected nodes");
    expect(result.nodes).toHaveLength(levels + 1);
    expect(result.nodes.at(-1)?.depth).toBe(levels);
    expect(result.deepGroups).toBe(levels - DESIGN_LIMITS.maxGroupDepth);
  });

  it("refuses a page that is not a page", () => {
    expect(readSketchPages([{ _class: "oops" }]).ok).toBe(false);
  });
});
