import type { Layer, Psd } from "ag-psd";
import { describe, expect, it } from "vitest";
import { decodePsd } from "@/lib/shared/design/import/handlers/psd-decode";
import { extractPsdMetadata } from "@/lib/shared/design/import/handlers/psd-metadata";
import { planPsd } from "@/lib/shared/design/import/handlers/psd-plan";
import { METADATA_LIMITS } from "@/lib/shared/design/import/metadata";
import { DesignImportColorMode, DesignImportFormat } from "@/lib/shared/design/import/types";
import { WorkerDocumentSchema } from "@/lib/shared/design/import/worker/protocol";

const BIDI = String.fromCharCode(0x202e);
const CR = String.fromCharCode(13);
const NL = String.fromCharCode(10);

const raw = { colorMode: 3, bitsPerChannel: 8, channels: [], large: false };

const rect = { left: 4, top: 6, right: 24, bottom: 36 };

const fixture = (children: Layer[], extra: Partial<Psd> = {}): Psd => ({
  width: 200,
  height: 100,
  bitsPerChannel: 8,
  colorMode: 3,
  children,
  ...extra,
});

const smartObject = (name: string): Layer => Object.assign({ name, ...rect }, { placedLayer: {} });
const adjustment = (name: string): Layer =>
  Object.assign({ name }, { adjustment: { type: "curves" } });

const mixed: Layer[] = [
  { name: "Fundo", ...rect, rawData: raw, opacity: 0.5, blendMode: "multiply" },
  {
    name: "Grupo",
    opened: true,
    children: [
      {
        name: "Titulo",
        ...rect,
        hidden: true,
        text: {
          text: "Ola" + CR + "mundo",
          style: {
            font: { name: "Roboto-Bold" },
            fontSize: 32,
            fillColor: { r: 255, g: 0, b: 10 },
          },
        },
      },
      smartObject("Selo"),
      adjustment("Curvas"),
      { name: "Caixa", ...rect, vectorFill: { type: "color", color: { r: 1, g: 2, b: 3 } } },
    ],
  },
];

const unreadableLayer = (): Layer => {
  const layer: Layer = { ...rect, rawData: raw };
  Object.defineProperty(layer, "name", {
    get: () => {
      throw new Error("boom");
    },
  });
  return layer;
};

describe("extractPsdMetadata", () => {
  it("maps the layer tree: names, parents, kinds, visibility, opacity, blend and bounds", () => {
    const metadata = extractPsdMetadata(fixture(mixed));
    expect(metadata?.layers.map((l) => [l.index, l.parentIndex, l.name, l.kind])).toEqual([
      [0, null, "Fundo", "raster"],
      [1, null, "Grupo", "group"],
      [2, 1, "Titulo", "text"],
      [3, 1, "Selo", "smart_object"],
      [4, 1, "Curvas", "adjustment"],
      [5, 1, "Caixa", "shape"],
    ]);
    expect(metadata?.layers[0]).toMatchObject({
      visible: true,
      opacity: 0.5,
      blendMode: "multiply",
      bounds: { left: 4, top: 6, width: 20, height: 30 },
    });
    expect(metadata?.layers[1]).toMatchObject({ blendMode: "pass through", bounds: null });
    expect(metadata?.layers[2]?.visible).toBe(false);
  });

  it("captures the source: format, color mode, depth, dimensions, no page count", () => {
    const metadata = extractPsdMetadata(fixture(mixed, { colorMode: 4, bitsPerChannel: 16 }));
    expect(metadata?.source).toEqual({
      format: DesignImportFormat.Psd,
      colorMode: DesignImportColorMode.Cmyk,
      bitsPerChannel: 16,
      pageCount: null,
    });
    expect(metadata?.dimensions).toEqual({
      sourceWidth: 200,
      sourceHeight: 100,
      pageWidth: 200,
      pageHeight: 100,
    });
    expect(extractPsdMetadata(fixture([], { colorMode: 9 }))?.source.colorMode).toBe("unknown");
    expect(extractPsdMetadata(fixture([], { colorMode: 1 }))?.source.colorMode).toBe("grayscale");
  });

  it("captures text runs with font, size and color, fonts and declared colors", () => {
    const metadata = extractPsdMetadata(fixture(mixed));
    expect(metadata?.textRuns).toEqual([
      {
        layerIndex: 2,
        text: "Ola" + NL + "mundo",
        fontName: "Roboto-Bold",
        fontSize: 32,
        color: { r: 255, g: 0, b: 10 },
      },
    ]);
    expect(metadata?.fonts).toEqual([{ name: "Roboto-Bold", usageCount: 1 }]);
    expect(metadata?.colors).toEqual(
      expect.arrayContaining([
        { r: 255, g: 0, b: 10, source: "text", count: 1 },
        { r: 1, g: 2, b: 3, source: "fill", count: 1 },
      ]),
    );
  });

  it("counts every style run for fonts and accepts float colors", () => {
    const text = {
      text: "abc",
      styleRuns: [
        { length: 1, style: { font: { name: "A" }, fillColor: { fr: 1, fg: 0, fb: 0 } } },
        { length: 2, style: { font: { name: "A" }, fillColor: { fr: 1, fg: 0, fb: 0 } } },
        { length: 1, style: { font: { name: "B" } } },
      ],
    };
    const metadata = extractPsdMetadata(fixture([{ name: "t", ...rect, text }]));
    expect(metadata?.fonts).toEqual([
      { name: "A", usageCount: 2 },
      { name: "B", usageCount: 1 },
    ]);
    expect(metadata?.colors).toEqual([{ r: 255, g: 0, b: 0, source: "text", count: 2 }]);
  });

  it("keeps hostile layer and text strings as inert, sanitized data", () => {
    const hostile = "<img onerror=x>" + BIDI;
    const metadata = extractPsdMetadata(
      fixture([
        { name: hostile, ...rect, text: { text: hostile, style: { font: { name: hostile } } } },
      ]),
    );
    expect(metadata?.layers[0]?.name).toBe("<img onerror=x>");
    expect(metadata?.textRuns[0]?.text).toBe("<img onerror=x>");
    expect(metadata?.fonts[0]?.name).toBe("<img onerror=x>");
  });

  it("walks a 5000-deep tree without recursion and truncates at the layer cap", () => {
    let node: Layer = { name: "leaf", ...rect, rawData: raw };
    for (let depth = 0; depth < 5000; depth += 1) node = { name: `g${depth}`, children: [node] };
    const metadata = extractPsdMetadata(fixture([node]));
    expect(metadata?.layers).toHaveLength(METADATA_LIMITS.maxLayers);
    expect(metadata?.truncation.layers).toBe(true);
    expect(metadata?.layers[5]?.parentIndex).toBe(4);
  });

  it("truncates a flat list over the cap and a 5 MB text, and flags both", () => {
    const flat = Array.from({ length: 1200 }, (_, i): Layer => ({ name: `l${i}`, ...rect }));
    const big: Layer = { name: "big", ...rect, text: { text: "z".repeat(5_000_000) } };
    const metadata = extractPsdMetadata(fixture([big, ...flat]));
    expect(metadata?.truncation.layers).toBe(true);
    expect(metadata?.textRuns[0]?.text).toHaveLength(METADATA_LIMITS.textRun);
    expect(metadata?.truncation.textRuns).toBe(true);
    expect(metadata?.truncation.textCharsDropped).toBe(5_000_000 - METADATA_LIMITS.textRun);
  });

  it("stores nothing outside the schema: no image resources, thumbnails or annotations", () => {
    const psd = Object.assign(fixture(mixed), {
      imageResources: { xmpMetadata: "<x:xmpmeta/>", thumbnail: {} },
      annotations: [{ type: "text" }],
    });
    const text = JSON.stringify(extractPsdMetadata(psd)).toLowerCase();
    for (const forbidden of ["xmp", "thumbnail", "annotation", "iptc", "icc", "exif", "gps"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("returns null instead of throwing when a layer cannot be read", () => {
    expect(extractPsdMetadata(fixture([unreadableLayer()]))).toBeNull();
  });
});

describe("a metadata failure never fails the PSD decode", () => {
  const source = {
    layerPixels: () => ({
      width: 20,
      height: 30,
      data: new Uint8ClampedArray(20 * 30 * 4).fill(255),
    }),
    maskPixels: () => undefined,
    compositePixels: () => undefined,
  };
  const limits = { capacityElements: 100, remainingBytes: 512 * 1024 * 1024, maxLayerSide: 16384 };

  const decode = (psd: Psd) => {
    const planned = planPsd(psd, limits);
    if (!planned.ok) throw new Error("plan expected");
    return decodePsd(psd, planned.plan, source, () => undefined);
  };

  it("puts the validated metadata into the worker document", () => {
    const document = decode(fixture([{ name: "a", ...rect, rawData: raw }]));
    expect(document.metadata?.layers[0]?.name).toBe("a");
    expect(document.nodes).toHaveLength(1);
    expect(WorkerDocumentSchema.safeParse(document).success).toBe(true);
  });

  it("keeps the layers and sets metadata to null when extraction throws", () => {
    let reads = 0;
    const layer: Layer = { ...rect, rawData: raw };
    Object.defineProperty(layer, "name", {
      get: () => {
        reads += 1;
        if (reads > 1) throw new Error("boom");
        return "a";
      },
    });
    const document = decode(fixture([layer]));
    expect(document.nodes).toHaveLength(1);
    expect(document.nodes[0]?.pixels).not.toBeNull();
    expect(document.metadata).toBeNull();
  });

  it("drops metadata that does not pass the schema on the main thread, keeps the document", () => {
    const document = decode(fixture([{ name: "a", ...rect, rawData: raw }]));
    const tampered = { ...document, metadata: { ...document.metadata, fileName: "secret.psd" } };
    const parsed = WorkerDocumentSchema.safeParse(tampered);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.metadata).toBeNull();
    const missing = WorkerDocumentSchema.safeParse({ ...document, metadata: undefined });
    expect(missing.success && missing.data.metadata).toBeNull();
  });
});
