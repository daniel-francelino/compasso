import { readImageHeader, orientedSize } from "@/lib/shared/design/import/handlers/image-header";
import {
  type TextPainter,
  renderCost,
  renderShape,
  renderSize,
  renderText,
} from "@/lib/shared/design/import/handlers/sketch-render";
import {
  type SketchArtboardInfo,
  type JsonValueBudget,
  type PageArtboards,
  type SketchNode,
  SketchNodeKind,
  newJsonValueBudget,
  parseSketchDocument,
  parseSketchJson,
  parseSketchMeta,
  readArtboardOfPage,
  readSketchPage,
} from "@/lib/shared/design/import/handlers/sketch-schema";
import {
  type ZipIndex,
  openZip,
  readZipEntry,
} from "@/lib/shared/design/import/handlers/sketch-zip";
import {
  DESIGN_IMPORT_LIMITS,
  SKETCH_LIMITS,
  pageSizeRefusal,
} from "@/lib/shared/design/import/limits";
import { failureReason } from "@/lib/shared/design/import/refusal";
import { hasJpegSignature, hasPngSignature } from "@/lib/shared/design/import/sniff";
import { DesignImportFormat } from "@/lib/shared/design/import/types";
import {
  SketchRefusal,
  type SketchLayer,
  type SketchRequest,
  type SketchResponse,
} from "@/lib/shared/design/import/worker/sketch-protocol";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import type { Failure, Result } from "@/lib/shared/server-utils";

type Size = { width: number; height: number };

export type SketchDeps = {
  decodeBitmap: (data: Uint8Array, target: Size) => Promise<PixelBuffer | null>;
  paintText: TextPainter;
};

export type SketchEngineRequest = Pick<
  SketchRequest,
  "id" | "usedBytes" | "capacityElements" | "artboard"
>;

export type SketchOutput = { response: SketchResponse; transfer: ArrayBuffer[] };

class Refused extends Error {
  readonly refusal: SketchRefusal;
  readonly args: number[];
  constructor(refusal: SketchRefusal, args: number[] = []) {
    super(refusal);
    this.refusal = refusal;
    this.args = args;
  }
}

const refusalOf = (failure: Failure): Refused => {
  const coded = failureReason(failure, SketchRefusal);
  return coded === null
    ? new Refused(SketchRefusal.Corrupt)
    : new Refused(coded.reason, coded.args);
};

const need = <T extends object>(result: Result<T>): Extract<Result<T>, { ok: true }> => {
  if (!result.ok) throw refusalOf(result);
  return result;
};

const META_ENTRY = "meta.json";
const DOCUMENT_ENTRY = "document.json";

type Loaded = { zip: ZipIndex; pageEntries: string[]; budget: JsonValueBudget };

const readJson = async (
  zip: ZipIndex,
  name: string,
  cap: number,
  budget: JsonValueBudget,
): Promise<unknown> => {
  const entry = need(await readZipEntry(zip, name, cap, undefined));
  return need(parseSketchJson(entry.data, budget)).value;
};

const load = async (bytes: Uint8Array): Promise<Loaded> => {
  const { zip } = need(openZip(bytes));
  const budget = newJsonValueBudget();
  need(
    parseSketchMeta(await readJson(zip, META_ENTRY, SKETCH_LIMITS.maxDocumentJsonBytes, budget)),
  );
  const refs = need(
    parseSketchDocument(
      await readJson(zip, DOCUMENT_ENTRY, SKETCH_LIMITS.maxDocumentJsonBytes, budget),
    ),
  );
  return { zip, pageEntries: refs.pageEntries, budget };
};

const readPageAt = async (loaded: Loaded, pageIndex: number): Promise<PageArtboards> => {
  const name = loaded.pageEntries[pageIndex];
  if (name === undefined) throw new Refused(SketchRefusal.Corrupt);
  const value = await readJson(loaded.zip, name, SKETCH_LIMITS.maxPageJsonBytes, loaded.budget);
  return need(readSketchPage(value, pageIndex));
};

const probeArtboards = async (
  loaded: Loaded,
): Promise<{ listed: SketchArtboardInfo[]; total: number }> => {
  const all: SketchArtboardInfo[] = [];
  for (let index = 0; index < loaded.pageEntries.length; index += 1) {
    all.push(...(await readPageAt(loaded, index)).infos);
  }
  return { listed: all.slice(0, SKETCH_LIMITS.maxArtboardsListed), total: all.length };
};

const BUILDABLE: ReadonlySet<SketchNodeKind> = new Set([
  SketchNodeKind.Rectangle,
  SketchNodeKind.Oval,
  SketchNodeKind.Path,
  SketchNodeKind.Bitmap,
  SketchNodeKind.Text,
]);

type Leaf = { node: SketchNode; hidden: boolean; opacity: number; x: number; y: number };

const collectLeaves = (
  nodes: readonly SketchNode[],
  counters: { styles: number; unsupported: number },
): Leaf[] => {
  const leaves: Leaf[] = [];
  const parents: { hidden: boolean; opacity: number; x: number; y: number }[] = [];
  for (const node of nodes) {
    const parent = parents[node.depth - 1] ?? { hidden: false, opacity: 1, x: 0, y: 0 };
    const state = {
      hidden: parent.hidden || !node.visible,
      opacity: parent.opacity * node.opacity,
      x: parent.x + node.frame.x,
      y: parent.y + node.frame.y,
    };
    parents[node.depth] = state;
    counters.styles += node.droppedStyles;
    if (node.kind === SketchNodeKind.Group) continue;
    if (BUILDABLE.has(node.kind)) leaves.push({ node, ...state });
    else counters.unsupported += 1;
  }
  return leaves;
};

const mirror = (buffer: PixelBuffer, horizontal: boolean, vertical: boolean): PixelBuffer => {
  if (!horizontal && !vertical) return buffer;
  const data = new Uint8ClampedArray(buffer.data.length);
  for (let y = 0; y < buffer.height; y += 1) {
    for (let x = 0; x < buffer.width; x += 1) {
      const sx = horizontal ? buffer.width - 1 - x : x;
      const sy = vertical ? buffer.height - 1 - y : y;
      const from = (sy * buffer.width + sx) * 4;
      data.set(buffer.data.subarray(from, from + 4), (y * buffer.width + x) * 4);
    }
  }
  return { width: buffer.width, height: buffer.height, data };
};

type DrawContext = {
  zip: ZipIndex;
  deps: SketchDeps;
  usedBytes: number;
  bound: number;
  decodes: { count: number; cache: Map<string, PixelBuffer> };
};

const IMAGE_ARG_CAP = 1_000_000_000;

const copyOf = (buffer: PixelBuffer): PixelBuffer => ({
  width: buffer.width,
  height: buffer.height,
  data: new Uint8ClampedArray(buffer.data),
});

const decodeChecked = async (
  data: Uint8Array,
  target: Size,
  deps: SketchDeps,
): Promise<PixelBuffer | null> => {
  try {
    const decoded = await deps.decodeBitmap(data, target);
    const valid =
      decoded !== null &&
      decoded.width >= 1 &&
      decoded.height >= 1 &&
      decoded.width <= DESIGN_IMPORT_LIMITS.maxPageSide &&
      decoded.height <= DESIGN_IMPORT_LIMITS.maxPageSide &&
      decoded.data.length === decoded.width * decoded.height * 4;
    return valid ? decoded : null;
  } catch {
    return null;
  }
};

const drawBitmap = async (leaf: Leaf, context: DrawContext): Promise<PixelBuffer | null> => {
  const { imageRef } = leaf.node;
  if (imageRef === null || !context.zip.entries.has(imageRef)) return null;
  const key = `${imageRef}|${leaf.node.flipHorizontal}|${leaf.node.flipVertical}`;
  const cached = context.decodes.cache.get(key);
  if (cached !== undefined) return copyOf(cached);
  const entry = need(
    await readZipEntry(context.zip, imageRef, SKETCH_LIMITS.maxImageBytes, undefined),
  );
  const format = hasPngSignature(entry.data)
    ? DesignImportFormat.Png
    : hasJpegSignature(entry.data)
      ? DesignImportFormat.Jpeg
      : null;
  if (format === null) return null;
  const header = readImageHeader(entry.data, format);
  if (!header.ok) return null;
  const declared = orientedSize(header.header);
  if (declared.width * declared.height > SKETCH_LIMITS.maxImagePixels) {
    throw new Refused(SketchRefusal.ImageTooLarge, [
      Math.min(declared.width, IMAGE_ARG_CAP),
      Math.min(declared.height, IMAGE_ARG_CAP),
    ]);
  }
  if (
    context.usedBytes + rasterBytes(declared.width, declared.height) >
    DESIGN_LIMITS.rasterBudgetBytes
  ) {
    throw new Refused(SketchRefusal.Memory);
  }
  context.decodes.count += 1;
  if (context.decodes.count > SKETCH_LIMITS.maxBitmapDecodes) {
    throw new Refused(SketchRefusal.LayerTooLarge);
  }
  const scale = Math.min(
    1,
    DESIGN_IMPORT_LIMITS.maxPageSide / Math.max(declared.width, declared.height),
  );
  const target = {
    width: Math.max(1, Math.round(declared.width * scale)),
    height: Math.max(1, Math.round(declared.height * scale)),
  };
  const decoded = await decodeChecked(entry.data, target, context.deps);
  if (decoded === null) return null;
  const result = mirror(decoded, leaf.node.flipHorizontal, leaf.node.flipVertical);
  context.decodes.cache.set(key, result);
  return result;
};

const drawLeaf = async (leaf: Leaf, context: DrawContext): Promise<PixelBuffer | null> => {
  if (leaf.node.kind === SketchNodeKind.Bitmap) return drawBitmap(leaf, context);
  const size = renderSize(leaf.node, context.bound);
  if (context.usedBytes + rasterBytes(size.width, size.height) > DESIGN_LIMITS.rasterBudgetBytes) {
    throw new Refused(SketchRefusal.Memory);
  }
  return leaf.node.kind === SketchNodeKind.Text
    ? renderText(leaf.node, context.deps.paintText, context.bound)
    : renderShape(leaf.node, context.bound);
};

const limitCoordinate = (value: number): number =>
  Math.max(-DESIGN_LIMITS.maxCoordinate, Math.min(DESIGN_LIMITS.maxCoordinate, Math.round(value)));

const limitSize = (value: number): number =>
  Math.max(1, Math.min(DESIGN_LIMITS.maxSize, Math.round(value)));

const owned = (data: Uint8ClampedArray): ArrayBuffer => {
  const { buffer } = data;
  if (
    buffer instanceof ArrayBuffer &&
    data.byteOffset === 0 &&
    buffer.byteLength === data.byteLength
  ) {
    return buffer;
  }
  const copy = new Uint8ClampedArray(data.length);
  copy.set(data);
  return copy.buffer;
};

const cutName = (name: string): string => {
  let cut = "";
  for (const character of name) {
    if (cut.length + character.length > DESIGN_LIMITS.layerNameMax) break;
    cut += character;
  }
  return cut;
};

const layerOf = (leaf: Leaf, buffer: PixelBuffer, scale: number): SketchLayer => ({
  name: cutName(leaf.node.name),
  x: limitCoordinate(leaf.x * scale),
  y: limitCoordinate(leaf.y * scale),
  width: limitSize(leaf.node.frame.width * scale),
  height: limitSize(leaf.node.frame.height * scale),
  rotation: -leaf.node.rotation,
  opacity: Math.max(0, Math.min(1, leaf.opacity)),
  hidden: leaf.hidden,
  isText: leaf.node.kind === SketchNodeKind.Text,
  pixelWidth: buffer.width,
  pixelHeight: buffer.height,
  pixels: owned(buffer.data),
});

const optionId = (info: SketchArtboardInfo): string => `${info.pageIndex}:${info.artboardIndex}`;

const build = async (
  loaded: Loaded,
  page: PageArtboards,
  info: SketchArtboardInfo,
  request: SketchEngineRequest,
  deps: SketchDeps,
): Promise<SketchOutput> => {
  const { artboard } = need(readArtboardOfPage(page, info));
  const longest = Math.max(info.width, info.height);
  const scale = Math.min(1, DESIGN_IMPORT_LIMITS.maxPageSide / Math.max(longest, 1));
  const width = Math.max(1, Math.round(info.width * scale));
  const height = Math.max(1, Math.round(info.height * scale));
  const tooSmallOrLarge = pageSizeRefusal(width, height);
  if (tooSmallOrLarge !== null) {
    throw new Refused(tooSmallOrLarge.refusal, [tooSmallOrLarge.limit]);
  }
  const counters = { styles: 0, unsupported: 0 };
  const leaves = collectLeaves(artboard.nodes, counters);
  if (leaves.length > request.capacityElements) {
    throw new Refused(SketchRefusal.TooManyLayers, [request.capacityElements]);
  }
  const bound = Math.max(1, Math.ceil(longest));
  const cost = leaves.reduce((sum, leaf) => sum + renderCost(leaf.node, bound), 0);
  if (cost > SKETCH_LIMITS.maxRenderCost) throw new Refused(SketchRefusal.LayerTooLarge);
  const deadline = performance.now() + SKETCH_LIMITS.timeoutMs;
  const layers: SketchLayer[] = [];
  const decodes = { count: 0, cache: new Map<string, PixelBuffer>() };
  let usedBytes = request.usedBytes;
  for (const leaf of leaves) {
    if (performance.now() > deadline) throw new Refused(SketchRefusal.TimedOut);
    const drawn = await drawLeaf(leaf, { zip: loaded.zip, deps, usedBytes, bound, decodes });
    if (drawn === null) {
      counters.unsupported += 1;
      continue;
    }
    usedBytes += rasterBytes(drawn.width, drawn.height);
    layers.push(layerOf(leaf, drawn, scale));
  }
  if (layers.length === 0) throw new Refused(SketchRefusal.NoLayers);
  return {
    response: {
      id: request.id,
      status: "result",
      width,
      height,
      layers,
      downscaled: scale < 1,
      styles: counters.styles,
      unsupported: counters.unsupported,
      deepGroups: artboard.deepGroups,
    },
    transfer: layers.map((layer) => layer.pixels),
  };
};

const parseArtboardId = (id: string): { page: number; index: number } => {
  const [page, index] = id.split(":").map(Number);
  if (page === undefined || index === undefined) throw new Refused(SketchRefusal.Corrupt);
  return { page, index };
};

const buildChosen = async (
  loaded: Loaded,
  info: SketchArtboardInfo,
  request: SketchEngineRequest,
  deps: SketchDeps,
): Promise<SketchOutput> => {
  const page = await readPageAt(loaded, info.pageIndex);
  return build(loaded, page, info, request, deps);
};

const resume = async (
  loaded: Loaded,
  artboard: string,
  request: SketchEngineRequest,
  deps: SketchDeps,
): Promise<SketchOutput> => {
  const wanted = parseArtboardId(artboard);
  const page = await readPageAt(loaded, wanted.page);
  const info = page.infos[wanted.index];
  if (info === undefined) throw new Refused(SketchRefusal.Corrupt);
  return build(loaded, page, info, request, deps);
};

const start = async (
  request: SketchEngineRequest,
  bytes: Uint8Array,
  deps: SketchDeps,
): Promise<SketchOutput> => {
  const loaded = await load(bytes);
  if (request.artboard !== null) return resume(loaded, request.artboard, request, deps);
  const { listed, total } = await probeArtboards(loaded);
  const first = listed[0];
  if (first === undefined || total === 0) throw new Refused(SketchRefusal.NoArtboards);
  if (listed.length === 1) return buildChosen(loaded, first, request, deps);
  return {
    response: {
      id: request.id,
      status: "choice",
      options: listed.map((info) => ({
        id: optionId(info),
        name: info.name,
        width: info.width,
        height: info.height,
      })),
    },
    transfer: [],
  };
};

export const runSketch = async (
  request: SketchEngineRequest,
  bytes: Uint8Array,
  deps: SketchDeps,
): Promise<SketchOutput> => {
  try {
    return await start(request, bytes, deps);
  } catch (error) {
    const refused = error instanceof Refused ? error : new Refused(SketchRefusal.Corrupt);
    return {
      response: { id: request.id, status: "error", refusal: refused.refusal, args: refused.args },
      transfer: [],
    };
  }
};
