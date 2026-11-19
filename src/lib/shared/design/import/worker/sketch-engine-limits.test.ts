import { describe, expect, it } from "vitest";
import { buildZip, text } from "@/lib/shared/design/import/handlers/sketch-zip-fixtures";
import {
  flattenLayers,
  parseSketchDocument,
} from "@/lib/shared/design/import/handlers/sketch-schema";
import { renderCost } from "@/lib/shared/design/import/handlers/sketch-render";
import { SKETCH_LIMITS } from "@/lib/shared/design/import/limits";
import { runSketch } from "@/lib/shared/design/import/worker/sketch-engine";
import {
  SketchRefusal,
  SketchRequestSchema,
  SketchResponseSchema,
} from "@/lib/shared/design/import/worker/sketch-protocol";

const json = (value: unknown): Uint8Array => text(JSON.stringify(value));

const rect = (name: string) => ({
  _class: "rectangle",
  name,
  frame: { x: 0, y: 0, width: 30, height: 20 },
  style: {
    fills: [{ isEnabled: true, fillType: 0, color: { red: 1, green: 0, blue: 0, alpha: 1 } }],
  },
});

const artboard = (name: string, layers: unknown[]) => ({
  _class: "artboard",
  do_objectID: name,
  name,
  frame: { x: 0, y: 0, width: 200, height: 100 },
  layers,
});

const bitmap = (name: string, ref: string) => ({
  _class: "bitmap",
  name,
  frame: { x: 0, y: 0, width: 20, height: 20 },
  image: { _ref: ref },
});

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

const zipOf = (
  refs: string[],
  pages: Record<string, unknown>,
  extra: { name: string; data: Uint8Array }[] = [],
  method = 8,
) =>
  buildZip([
    { name: "meta.json", data: json({ version: 136 }) },
    { name: "document.json", data: json({ pages: refs.map((ref) => ({ _ref: ref })) }) },
    ...Object.entries(pages).map(([name, value]) => ({
      name: `${name}.json`,
      data: json(value),
      method,
    })),
    ...extra,
  ]);

const request = (artboardId: string | null = null, usedBytes = 0) => ({
  id: 0,
  usedBytes,
  capacityElements: 200,
  artboard: artboardId,
});

const calls = { decoded: 0 };
const deps = {
  decodeBitmap: async (_data: Uint8Array, target: { width: number; height: number }) => {
    calls.decoded += 1;
    return { ...target, data: new Uint8ClampedArray(target.width * target.height * 4).fill(7) };
  },
  paintText: () => null,
};

const refusalOf = (output: Awaited<ReturnType<typeof runSketch>>) =>
  output.response.status === "error" ? output.response.refusal : output.response.status;

const BULK_VALUES = 1_000_000;

const bulkLayers = (values: number): unknown[] =>
  Array.from({ length: Math.floor(values / 2) }, (_, index) => ({ n: (index * 7919) % 1_000_003 }));

describe("sketch job memory bounds", () => {
  it("dedupes repeated page refs in document.json", () => {
    const refs = Array.from({ length: 40 }, () => ({ _ref: "pages/x" }));
    const parsed = parseSketchDocument({ pages: refs });
    expect(parsed.ok && parsed.pageEntries).toEqual(["pages/x.json"]);
  });

  it("holds one page, not forty, when the same heavy page is listed 40 times", async () => {
    const page = {
      _class: "page",
      layers: [artboard("A", [rect("r")])],
      extra: bulkLayers(BULK_VALUES),
    };
    const bytes = await zipOf(
      Array.from({ length: 40 }, () => "pages/x"),
      { "pages/x": page },
      [],
      0,
    );
    const output = await runSketch(request(), bytes, deps);
    expect(refusalOf(output)).toBe("result");
  }, 60_000);

  it("refuses distinct heavy pages once the job value cap is spent", async () => {
    const heavy = {
      _class: "page",
      layers: [artboard("A", [rect("r")])],
      extra: bulkLayers(BULK_VALUES),
    };
    const count = Math.ceil(SKETCH_LIMITS.maxJobJsonValues / BULK_VALUES) + 1;
    const names = Array.from({ length: count }, (_, index) => `pages/p${index}`);
    const bytes = await zipOf(names, Object.fromEntries(names.map((name) => [name, heavy])), [], 0);
    const output = await runSketch(request(), bytes, deps);
    expect(refusalOf(output)).toBe(SketchRefusal.Corrupt);
  }, 120_000);

  it("keeps the choice probe to the artboard list and resumes with only the chosen page", async () => {
    const bytes = await zipOf(["pages/a", "pages/b"], {
      "pages/a": { _class: "page", layers: [artboard("One", [rect("a")])] },
      "pages/b": { _class: "page", layers: [artboard("Two", [rect("b"), rect("c")])] },
    });
    const probe = await runSketch(request(), bytes, deps);
    expect(probe.response.status).toBe("choice");
    const resumed = await runSketch(request("1:0"), bytes, deps);
    expect(resumed.response.status === "result" && resumed.response.layers).toHaveLength(2);
    expect(refusalOf(await runSketch(request("5:0"), bytes, deps))).toBe(SketchRefusal.Corrupt);
    expect(refusalOf(await runSketch(request("0:9"), bytes, deps))).toBe(SketchRefusal.Corrupt);
  }, 90000);
});

describe("sketch bitmap budget", () => {
  it("charges the full declared decode against the raster budget before decoding", async () => {
    const bytes = await zipOf(
      ["pages/p"],
      { "pages/p": { _class: "page", layers: [artboard("A", [bitmap("big", "images/b.png")])] } },
      [{ name: "images/b.png", data: pngHeader(8192, 8192) }],
    );
    calls.decoded = 0;
    const output = await runSketch(request(null, 300 * 1024 * 1024), bytes, deps);
    expect(refusalOf(output)).toBe(SketchRefusal.Memory);
    expect(calls.decoded).toBe(0);
  }, 90000);

  it("decodes one image once for many layers and caps distinct decodes", async () => {
    const same = Array.from({ length: 10 }, (_, index) => bitmap(`s${index}`, "images/a.png"));
    const bytes = await zipOf(
      ["pages/p"],
      { "pages/p": { _class: "page", layers: [artboard("A", same)] } },
      [{ name: "images/a.png", data: pngHeader(16, 8) }],
    );
    calls.decoded = 0;
    const output = await runSketch(request(), bytes, deps);
    expect(output.response.status === "result" && output.response.layers).toHaveLength(10);
    expect(calls.decoded).toBe(1);
    const total = SKETCH_LIMITS.maxBitmapDecodes + 1;
    const files = Array.from({ length: total }, (_, index) => ({
      name: `images/i${index}.png`,
      data: pngHeader(16, 8),
    }));
    const many = await zipOf(
      ["pages/p"],
      {
        "pages/p": {
          _class: "page",
          layers: [
            artboard(
              "A",
              files.map((file, index) => bitmap(`m${index}`, file.name)),
            ),
          ],
        },
      },
      files,
    );
    expect(refusalOf(await runSketch(request(), many, deps))).toBe(SketchRefusal.LayerTooLarge);
  });

  it("sends a clamped, schema-valid refusal for an absurd declared image size", async () => {
    const bytes = await zipOf(
      ["pages/p"],
      { "pages/p": { _class: "page", layers: [artboard("A", [bitmap("h", "images/h.png")])] } },
      [{ name: "images/h.png", data: pngHeader(2_147_483_647, 2_147_483_647) }],
    );
    const output = await runSketch(request(), bytes, deps);
    expect(SketchResponseSchema.safeParse(output.response).success).toBe(true);
    expect(refusalOf(output)).toBe(SketchRefusal.ImageTooLarge);
  });

  it("counts bitmaps and the shape subsamples in the render cost", () => {
    const flat = flattenLayers([
      { ...rect("r"), frame: { x: 0, y: 0, width: 100, height: 100 } },
      { ...bitmap("b", "images/a.png"), frame: { x: 0, y: 0, width: 100, height: 100 } },
    ]);
    if (!flat.ok) throw new Error("expected nodes");
    const [shape, picture] = flat.nodes;
    if (shape === undefined || picture === undefined) throw new Error("expected two nodes");
    expect(renderCost(picture, 1000)).toBe(10_000);
    expect(renderCost(shape, 1000)).toBe(160_000);
  });
});

describe("sketch layer names and request size", () => {
  it("never ends a name in a lone surrogate", async () => {
    const name = `a${String.fromCodePoint(0x1f600).repeat(79)}`;
    const bytes = await zipOf(["pages/p"], {
      "pages/p": { _class: "page", layers: [artboard("A", [rect(name)])] },
    });
    const output = await runSketch(request(), bytes, deps);
    if (output.response.status !== "result") throw new Error("expected a result");
    const layerName = output.response.layers[0]?.name ?? "";
    expect(layerName.length).toBeLessThanOrEqual(80);
    expect(() => encodeURIComponent(layerName)).not.toThrow();
    expect(layerName.startsWith("a")).toBe(true);
  });

  it("refuses a file above the Sketch size cap in the request schema", () => {
    const file = new File([new Uint8Array(8)], "a.sketch");
    Object.defineProperty(file, "size", { value: SKETCH_LIMITS.maxFileBytes + 1 });
    const base = { id: 0, usedBytes: 0, capacityElements: 1, artboard: null };
    expect(SketchRequestSchema.safeParse({ ...base, file }).success).toBe(false);
    expect(
      SketchRequestSchema.safeParse({ ...base, file: new File([new Uint8Array(8)], "b") }).success,
    ).toBe(true);
  });
});
