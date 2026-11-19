import { describe, expect, it } from "vitest";
import { type SketchRunner, createSketchHandler } from "@/lib/shared/design/import/handlers/sketch";
import {
  type FixtureEntry,
  buildZip,
  text,
} from "@/lib/shared/design/import/handlers/sketch-zip-fixtures";
import { SKETCH_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE, SKETCH_ARTBOARD_CHOICE } from "@/lib/shared/design/import/messages";
import {
  DesignImportFormat,
  DesignImportNoteKind,
  IMPORT_NEEDS_CHOICE,
  type ImportOutcome,
} from "@/lib/shared/design/import/types";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import { checkSketchResponse } from "@/lib/shared/design/import/worker/sketch-client";
import { type SketchDeps, runSketch } from "@/lib/shared/design/import/worker/sketch-engine";
import { SketchResponseSchema } from "@/lib/shared/design/import/worker/sketch-protocol";
import { invalid, type Result } from "@/lib/shared/server-utils";

const red = { red: 1, green: 0, blue: 0, alpha: 1 };
const fill = { fills: [{ isEnabled: true, fillType: 0, color: red }] };
const rect = (name: string, extra: Record<string, unknown> = {}) => ({
  _class: "rectangle",
  name,
  frame: { x: 5, y: 6, width: 30, height: 20 },
  style: fill,
  ...extra,
});
const artboard = (name: string, layers: unknown[], size = { width: 200, height: 100 }) => ({
  _class: "artboard",
  do_objectID: name,
  name,
  frame: { x: 0, y: 0, ...size },
  layers,
});

const json = (value: unknown): Uint8Array => text(JSON.stringify(value));

const sketchBytes = async (
  artboards: unknown[],
  extra: FixtureEntry[] = [],
  version = 136,
): Promise<Uint8Array> =>
  buildZip([
    { name: "meta.json", data: json({ version }) },
    { name: "document.json", data: json({ pages: [{ _ref: "pages/P1" }] }) },
    { name: "pages/P1.json", data: json({ _class: "page", layers: artboards }), method: 8 },
    ...extra,
  ]);

type Size = { width: number; height: number };
type Decoder = SketchDeps["decodeBitmap"];

const filled = (size: Size, value: number): PixelBuffer => ({
  ...size,
  data: new Uint8ClampedArray(size.width * size.height * 4).fill(value),
});

const depsWith = (decodeBitmap: Decoder): SketchDeps => ({ decodeBitmap, paintText: () => null });
const echoDeps = depsWith(async (_data, target) => filled(target, 9));

const pngHeader = (width: number, height: number): Uint8Array => {
  const png = new Uint8Array(33);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(png.buffer);
  view.setUint32(8, 13);
  png.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return png;
};

const bitmapLayer = (name: string, ref: string, size = { width: 16, height: 8 }) => ({
  _class: "bitmap",
  name,
  frame: { x: 0, y: 0, ...size },
  image: { _ref: ref },
});

const runnerFor =
  (bytes: Uint8Array, deps: SketchDeps): SketchRunner =>
  async (request) => {
    const output = await runSketch({ id: 0, ...request }, bytes, deps);
    const parsed = SketchResponseSchema.safeParse(output.response);
    if (!parsed.success) return invalid("malformed");
    return checkSketchResponse(parsed.data, request);
  };

const run = async (
  bytes: Uint8Array,
  options: { capacity?: number; usedBytes?: number; deps?: SketchDeps } = {},
): Promise<Result<ImportOutcome>> => {
  const handler = createSketchHandler(runnerFor(bytes, options.deps ?? echoDeps));
  if (handler.runsIn !== "worker") throw new Error("expected a worker handler");
  let counter = 0;
  const file = new File([bytes.slice()], "a.sketch");
  return handler.decode({
    file,
    newId: () => `id${(counter += 1)}`,
    capacityElements: options.capacity ?? 200,
    usedBytes: options.usedBytes ?? 0,
  });
};

const designOf = (result: Result<ImportOutcome>) => {
  if (!result.ok || result.kind !== "document") throw new Error("expected a document");
  return result.design;
};

describe("sketch handler", () => {
  it("imports a single artboard with names and order, drops styles with notes", async () => {
    const bytes = await sketchBytes([
      artboard("A", [
        rect("first"),
        rect("second", { style: { ...fill, borders: [{ isEnabled: true }] } }),
        { _class: "hotspot", name: "h", frame: { x: 0, y: 0, width: 1, height: 1 } },
      ]),
    ]);
    const design = designOf(await run(bytes));
    expect(design.format).toBe(DesignImportFormat.Sketch);
    expect(design.elements.map((element) => element.name)).toEqual(["first", "second"]);
    expect(design.metadata).toBeNull();
    expect(design.notes).toEqual([
      { kind: DesignImportNoteKind.LayerStyleDropped, count: 1 },
      { kind: DesignImportNoteKind.UnsupportedNode, count: 1 },
    ]);
  });

  it("asks for a choice with three artboards and resumes into the chosen one", async () => {
    const bytes = await sketchBytes([
      artboard("One", [rect("a")]),
      artboard("Two", [rect("b"), rect("c")]),
      artboard("", [rect("d")]),
    ]);
    const result = await run(bytes);
    if (!result.ok || result.kind !== IMPORT_NEEDS_CHOICE) throw new Error("expected a choice");
    expect(result.choice.title).toBe(SKETCH_ARTBOARD_CHOICE.title);
    expect(result.choice.options.map((option) => option.label)).toEqual([
      "One",
      "Two",
      SKETCH_ARTBOARD_CHOICE.option(3),
    ]);
    expect(result.choice.options[0]?.detail).toBe("200 × 100 px");
    const second = result.choice.options[1];
    if (second === undefined) throw new Error("no option");
    const resumed = designOf(await result.resume(second.id));
    expect(resumed.elements.map((element) => element.name)).toEqual(["b", "c"]);
    for (const unoffered of ["9:9", "0:3", "1:0", "0:-1", "abc", ""]) {
      const refused = await result.resume(unoffered);
      expect(refused.ok ? null : refused.message).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
    }
  });

  it("flattens groups, propagates hidden and offsets, and counts deep groups", async () => {
    let layer: unknown = rect("leaf");
    for (let level = 0; level < 9; level += 1) {
      layer = {
        _class: "group",
        name: `g${level}`,
        isVisible: level !== 0,
        frame: { x: 1, y: 1, width: 10, height: 10 },
        layers: [layer],
      };
    }
    const design = designOf(await run(await sketchBytes([artboard("A", [layer])])));
    expect(design.elements).toHaveLength(1);
    expect(design.elements[0]?.hidden).toBe(true);
    expect(design.elements[0]?.x).toBe(14);
    expect(design.notes).toContainEqual({ kind: DesignImportNoteKind.GroupsFlattened, count: 1 });
  });

  it("downscales an artboard of 10000 px to 4096 and notes it", async () => {
    const bytes = await sketchBytes([
      artboard("Big", [rect("r", { frame: { x: 0, y: 0, width: 50, height: 50 } })], {
        width: 10000,
        height: 10000,
      }),
    ]);
    const design = designOf(await run(bytes));
    expect([design.width, design.height]).toEqual([4096, 4096]);
    expect(design.notes).toContainEqual({ kind: DesignImportNoteKind.Downscaled, count: 1 });
  });

  it("refuses 300 layers against the capacity and refuses a tiny artboard", async () => {
    const many = Array.from({ length: 300 }, (_, index) => rect(`r${index}`));
    const refused = await run(await sketchBytes([artboard("A", many)]), { capacity: 200 });
    expect(refused.ok ? null : refused.message).toBe(DESIGN_IMPORT_MESSAGE.tooManyLayers(200));
    const tiny = await run(
      await sketchBytes([artboard("T", [rect("r")], { width: 10, height: 10 })]),
    );
    expect(tiny.ok).toBe(false);
  });

  it("refuses a missing artboard list, an old version, bad json and a hostile archive", async () => {
    const none = await run(await sketchBytes([]));
    expect(none.ok ? null : none.message).toBe(DESIGN_IMPORT_MESSAGE.sketchNoArtboards);
    const old = await run(await sketchBytes([artboard("A", [rect("r")])], [], 10));
    expect(old.ok ? null : old.message).toBe(DESIGN_IMPORT_MESSAGE.sketchUnsupportedVersion);
    const broken = await buildZip([
      { name: "meta.json", data: text("{") },
      { name: "document.json", data: json({ pages: [{ _ref: "pages/P1" }] }) },
    ]);
    const corrupt = await run(broken);
    expect(corrupt.ok ? null : corrupt.message).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
    const traversal = await run(await sketchBytes([], [{ name: "../evil", data: text("x") }]));
    expect(traversal.ok ? null : traversal.message).toBe(DESIGN_IMPORT_MESSAGE.zipUnsafePath);
  });

  it("refuses a layer that fails the schema with no partial import", async () => {
    const bad = rect("bad", { frame: { x: 0, y: 0, width: -1, height: 1 } });
    const result = await run(await sketchBytes([artboard("A", [rect("ok"), bad])]));
    expect(result.ok ? null : result.message).toBe(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
  });

  it("refuses when the raster budget cannot hold the layers", async () => {
    const result = await run(await sketchBytes([artboard("A", [rect("r")])]), {
      usedBytes: 512 * 1024 * 1024,
    });
    expect(result.ok ? null : result.message).toBe(DESIGN_IMPORT_MESSAGE.memory);
  });

  it("skips a bitmap whose reference is missing or is not an image", async () => {
    const bytes = await sketchBytes(
      [
        artboard("A", [
          rect("ok"),
          bitmapLayer("missing", "images/none.png"),
          bitmapLayer("text", "images/t.png"),
        ]),
      ],
      [{ name: "images/t.png", data: text("not an image") }],
    );
    const design = designOf(await run(bytes));
    expect(design.elements.map((element) => element.name)).toEqual(["ok"]);
    expect(design.notes).toContainEqual({ kind: DesignImportNoteKind.UnsupportedNode, count: 2 });
  });

  it("refuses a PNG header of 60000 px with the exact image-too-large failure", async () => {
    const huge = await sketchBytes(
      [artboard("A", [bitmapLayer("huge", "images/h.png")])],
      [{ name: "images/h.png", data: pngHeader(60000, 60000) }],
    );
    const refused = await run(huge);
    expect(refused.ok ? null : refused.message).toBe(
      DESIGN_IMPORT_MESSAGE.imageTooLarge(60000, 60000),
    );
  });

  it("accepts a PNG header right at the pixel cap and refuses one pixel row more", async () => {
    const side = Math.floor(Math.sqrt(SKETCH_LIMITS.maxImagePixels));
    const decoded: Size[] = [];
    const deps = depsWith(async (_data, target) => {
      decoded.push(target);
      return filled({ width: 1, height: 1 }, 1);
    });
    const at = await sketchBytes(
      [artboard("A", [bitmapLayer("edge", "images/e.png")])],
      [{ name: "images/e.png", data: pngHeader(side, side) }],
    );
    expect((await run(at, { deps })).ok).toBe(true);
    expect(decoded).toEqual([{ width: 4096, height: 4096 }]);
    const over = await sketchBytes(
      [artboard("A", [bitmapLayer("over", "images/e.png")])],
      [{ name: "images/e.png", data: pngHeader(side + 1, side + 1) }],
    );
    const refused = await run(over, { deps });
    expect(refused.ok ? null : refused.message).toBe(
      DESIGN_IMPORT_MESSAGE.imageTooLarge(side + 1, side + 1),
    );
  });

  it("asks the decoder for a target no larger than the page side", async () => {
    const targets: Size[] = [];
    const deps = depsWith(async (_data, target) => {
      targets.push(target);
      return filled(target, 9);
    });
    const bytes = await sketchBytes(
      [artboard("A", [bitmapLayer("wide", "images/w.png")])],
      [{ name: "images/w.png", data: pngHeader(8192, 2048) }],
    );
    expect((await run(bytes, { deps })).ok).toBe(true);
    expect(targets).toEqual([{ width: 4096, height: 1024 }]);
  });

  it("keeps the decoder pixels and size rather than assuming the requested target", async () => {
    const deps = depsWith(async () => filled({ width: 4, height: 2 }, 7));
    const bytes = await sketchBytes(
      [artboard("A", [bitmapLayer("pic", "images/p.png")])],
      [{ name: "images/p.png", data: pngHeader(16, 8) }],
    );
    const design = designOf(await run(bytes, { deps }));
    const buffer = design.buffers.get(design.elements[0]?.id ?? "");
    expect([buffer?.width, buffer?.height]).toEqual([4, 2]);
    expect(buffer?.data.every((value) => value === 7)).toBe(true);
    expect(design.elements[0]?.pixelWidth).toBe(4);
    expect(design.elements[0]?.width).toBe(16);
  });

  it("skips a bitmap when the decoder returns an invalid buffer, throws or returns nothing", async () => {
    const wrongLength: PixelBuffer = { width: 4, height: 4, data: new Uint8ClampedArray(10) };
    const oversize: PixelBuffer = {
      width: 4097,
      height: 1,
      data: new Uint8ClampedArray(4097 * 4),
    };
    const decoders: Decoder[] = [
      async () => wrongLength,
      async () => oversize,
      async () => filled({ width: 0, height: 0 }, 0),
      async () => null,
      async () => {
        throw new Error("decode failed");
      },
    ];
    for (const decode of decoders) {
      const bytes = await sketchBytes(
        [artboard("A", [rect("ok"), bitmapLayer("pic", "images/p.png")])],
        [{ name: "images/p.png", data: pngHeader(16, 8) }],
      );
      const design = designOf(await run(bytes, { deps: depsWith(decode) }));
      expect(design.elements.map((element) => element.name)).toEqual(["ok"]);
      expect(design.notes).toContainEqual({ kind: DesignImportNoteKind.UnsupportedNode, count: 1 });
    }
  });

  it("decodes a valid bitmap through the injected decoder at the requested size", async () => {
    const bytes = await sketchBytes(
      [artboard("A", [bitmapLayer("pic", "images/p.png")])],
      [{ name: "images/p.png", data: pngHeader(16, 8) }],
    );
    const design = designOf(await run(bytes));
    expect(design.elements.map((element) => element.name)).toEqual(["pic"]);
    const buffer = design.buffers.get(design.elements[0]?.id ?? "");
    expect([buffer?.width, buffer?.height]).toEqual([16, 8]);
    expect(buffer?.data.every((value) => value === 9)).toBe(true);
  });
});
