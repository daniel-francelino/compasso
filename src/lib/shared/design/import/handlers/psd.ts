import type { BlendMode } from "ag-psd";
import { sizeFitsPage } from "@/lib/shared/design/import/limits";
import {
  DESIGN_IMPORT_LAYER_NAME,
  DESIGN_IMPORT_MESSAGE,
  IMPORT_CANCELLED,
} from "@/lib/shared/design/import/messages";
import { sanitizeImportName } from "@/lib/shared/design/import/sanitize";
import { hasPsdSignature } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  DesignImportNoteKind,
  type ImportHandler,
  type ImportKindResult,
  type ImportNote,
  type ImportedDesign,
  type WorkerImportInput,
} from "@/lib/shared/design/import/types";
import type { WorkerDocument, WorkerNode } from "@/lib/shared/design/import/worker/protocol";
import {
  ImportCancelledError,
  startImportJob,
} from "@/lib/shared/design/import/worker/worker-client";
import { createRasterLayer, emptyPage } from "@/lib/shared/design/document";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import type { DesignElement, GroupElement, RasterElement } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignBlendMode, DesignElementKind } from "@/lib/shared/design/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const PSD_HEADER_BYTES = 26;
const PSD_VERSION_OFFSET = 4;
const PSD_HEIGHT_OFFSET = 14;
const PSD_WIDTH_OFFSET = 18;
const PSD_DEPTH_OFFSET = 22;
const PSD_COLOR_MODE_OFFSET = 24;
const PSD_VERSION_PSD = 1;
const COLOR_MODE_CMYK = 4;
const COLOR_MODE_RGB = 3;
const SUPPORTED_COLOR_MODES = [0, 1, 2, COLOR_MODE_RGB, COLOR_MODE_CMYK];

export type PsdHeader = {
  width: number;
  height: number;
  depth: number;
  colorMode: number;
};

export const readPsdHeader = (bytes: Uint8Array): Result<{ header: PsdHeader }> => {
  if (bytes.length < PSD_HEADER_BYTES) return invalid(DESIGN_IMPORT_MESSAGE.corrupt);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(PSD_VERSION_OFFSET) !== PSD_VERSION_PSD) {
    return invalid(DESIGN_IMPORT_MESSAGE.psb);
  }
  const header = {
    height: view.getUint32(PSD_HEIGHT_OFFSET),
    width: view.getUint32(PSD_WIDTH_OFFSET),
    depth: view.getUint16(PSD_DEPTH_OFFSET),
    colorMode: view.getUint16(PSD_COLOR_MODE_OFFSET),
  };
  if (!SUPPORTED_COLOR_MODES.includes(header.colorMode)) {
    return invalid(DESIGN_IMPORT_MESSAGE.psdColorMode);
  }
  const fits = sizeFitsPage(header.width, header.height);
  return fits.ok ? { ok: true, header } : fits;
};

const BLEND_MODES: Partial<Record<BlendMode, DesignBlendMode>> = {
  normal: DesignBlendMode.Normal,
  "pass through": DesignBlendMode.Normal,
  darken: DesignBlendMode.Darken,
  multiply: DesignBlendMode.Multiply,
  "color burn": DesignBlendMode.ColorBurn,
  lighten: DesignBlendMode.Lighten,
  screen: DesignBlendMode.Screen,
  "color dodge": DesignBlendMode.ColorDodge,
  overlay: DesignBlendMode.Overlay,
  "soft light": DesignBlendMode.SoftLight,
  "hard light": DesignBlendMode.HardLight,
  difference: DesignBlendMode.Difference,
  exclusion: DesignBlendMode.Exclusion,
  hue: DesignBlendMode.Hue,
  saturation: DesignBlendMode.Saturation,
  color: DesignBlendMode.Color,
  luminosity: DesignBlendMode.Luminosity,
};

const blendModeOf = (name: string): DesignBlendMode | undefined =>
  Object.entries(BLEND_MODES).find(([key]) => key === name)?.[1];

type Counters = {
  text: number;
  smartObjects: number;
  effects: number;
  adjustments: number;
  blendModes: number;
  clips: number;
  flattenedGroups: number;
};

type Context = {
  width: number;
  height: number;
  newId: () => string;
  budgetBytes: number;
  usedBytes: number;
  buffers: Map<string, PixelBuffer>;
  counters: Counters;
};

type Frame = {
  depth: number;
  parentId: string | null;
  level: number;
  group: GroupElement | null;
  previous: DesignElement | undefined;
};

const newCounters = (): Counters => ({
  text: 0,
  smartObjects: 0,
  effects: 0,
  adjustments: 0,
  blendModes: 0,
  clips: 0,
  flattenedGroups: 0,
});

class MemoryLimitError extends Error {}

const MAX_GROUP_PARENT_LEVEL = DESIGN_LIMITS.maxGroupDepth - 1;
const ROOT_DEPTH = -1;
const PASS_THROUGH = "pass through";

const nameOf = (node: WorkerNode, fallback: string): string => {
  const name = sanitizeImportName(node.name);
  return name === "" ? fallback : name;
};

const blendOf = (node: WorkerNode, context: Context): DesignBlendMode => {
  const mapped = blendModeOf(node.blendMode);
  if (mapped === undefined) context.counters.blendModes += 1;
  return mapped ?? DesignBlendMode.Normal;
};

const noteSpecial = (node: WorkerNode, context: Context) => {
  if (node.adjustment) {
    context.counters.adjustments += 1;
    return;
  }
  if (node.text) context.counters.text += 1;
  if (node.smartObject) context.counters.smartObjects += 1;
  if (node.effects) context.counters.effects += 1;
};

const rasterOf = (
  node: WorkerNode,
  parentId: string | null,
  previous: DesignElement | undefined,
  context: Context,
): RasterElement | null => {
  noteSpecial(node, context);
  const { box, pixels } = node;
  if (node.adjustment || box === null || pixels === null) return null;
  const bytes = rasterBytes(box.width, box.height);
  if (context.usedBytes + bytes > context.budgetBytes) throw new MemoryLimitError();
  context.usedBytes += bytes;
  const id = context.newId();
  context.buffers.set(id, {
    width: box.width,
    height: box.height,
    data: new Uint8ClampedArray(pixels),
  });
  const canClip = previous?.kind === DesignElementKind.Raster;
  if (node.clipping && !canClip) context.counters.clips += 1;
  return {
    ...createRasterLayer(id, emptyPage("import"), context),
    x: box.left,
    y: box.top,
    width: box.width,
    height: box.height,
    pixelWidth: box.width,
    pixelHeight: box.height,
    name: nameOf(node, DESIGN_IMPORT_LAYER_NAME.layer),
    hidden: node.hidden,
    opacity: node.opacity,
    fillOpacity: node.fillOpacity,
    blendMode: blendOf(node, context),
    clipToBelow: node.clipping && canClip,
    parentId,
  };
};

const groupOf = (node: WorkerNode, parentId: string | null, context: Context): GroupElement => ({
  id: context.newId(),
  kind: DesignElementKind.Group,
  x: 0,
  y: 0,
  width: context.width,
  height: context.height,
  rotation: 0,
  opacity: node.opacity,
  locked: false,
  groupId: null,
  blendMode: blendOf(node, context),
  fillOpacity: 1,
  name: nameOf(node, DESIGN_IMPORT_LAYER_NAME.group),
  hidden: node.hidden,
  parentId,
  clipToBelow: false,
  mask: null,
  collapsed: !node.opened,
  passThrough: node.blendMode === PASS_THROUGH,
});

const openFrame = (
  node: WorkerNode,
  parent: Frame,
  context: Context,
  pending: Set<GroupElement>,
): Frame => {
  if (parent.level >= MAX_GROUP_PARENT_LEVEL) {
    context.counters.flattenedGroups += 1;
    return {
      depth: node.depth,
      parentId: parent.parentId,
      level: parent.level,
      group: null,
      previous: undefined,
    };
  }
  const group = groupOf(node, parent.parentId, context);
  pending.add(group);
  return {
    depth: node.depth,
    parentId: group.id,
    level: parent.level + 1,
    group,
    previous: undefined,
  };
};

const pendingGroups = (stack: readonly Frame[], pending: Set<GroupElement>): GroupElement[] =>
  stack.flatMap((frame) =>
    frame.group !== null && pending.delete(frame.group) ? [frame.group] : [],
  );

const emitLayers = (nodes: readonly WorkerNode[], context: Context): DesignElement[] => {
  const emitted: DesignElement[] = [];
  const pending = new Set<GroupElement>();
  const stack: Frame[] = [
    { depth: ROOT_DEPTH, parentId: null, level: 0, group: null, previous: undefined },
  ];
  for (const node of nodes) {
    while (stack.length > 1 && (stack.at(-1)?.depth ?? ROOT_DEPTH) >= node.depth) stack.pop();
    const parent = stack.at(-1);
    if (parent === undefined) continue;
    if (node.group) {
      stack.push(openFrame(node, parent, context, pending));
      continue;
    }
    const raster = rasterOf(node, parent.parentId, parent.previous, context);
    if (raster === null) continue;
    emitted.push(...pendingGroups(stack, pending), raster);
    for (const frame of stack) frame.previous = raster;
  }
  return emitted;
};

const notesOf = (counters: Counters, document: WorkerDocument): ImportNote[] => {
  const candidates: ImportNote[] = [
    { kind: DesignImportNoteKind.FlattenedImageOnly, count: document.flattened ? 1 : 0 },
    { kind: DesignImportNoteKind.TextAsPixels, count: counters.text },
    { kind: DesignImportNoteKind.SmartObjectAsPixels, count: counters.smartObjects },
    { kind: DesignImportNoteKind.LayerStyleDropped, count: counters.effects },
    { kind: DesignImportNoteKind.AdjustmentLayerDropped, count: counters.adjustments },
    { kind: DesignImportNoteKind.BlendModeFallback, count: counters.blendModes },
    { kind: DesignImportNoteKind.ClippingPartial, count: counters.clips },
    { kind: DesignImportNoteKind.GroupsFlattened, count: counters.flattenedGroups },
    { kind: DesignImportNoteKind.CmykConverted, count: document.cmyk ? 1 : 0 },
    { kind: DesignImportNoteKind.DepthReduced, count: document.depthReduced ? 1 : 0 },
  ];
  return candidates.filter((note) => note.count > 0);
};

export const psdToDesign = (
  document: WorkerDocument,
  options: { newId: () => string; budgetBytes?: number },
): Result<{ design: ImportedDesign }> => {
  const fits = sizeFitsPage(document.width, document.height);
  if (!fits.ok) return fits;
  const context: Context = {
    width: document.width,
    height: document.height,
    newId: options.newId,
    budgetBytes: options.budgetBytes ?? DESIGN_LIMITS.rasterBudgetBytes,
    usedBytes: 0,
    buffers: new Map(),
    counters: newCounters(),
  };
  try {
    const elements = emitLayers(document.nodes, context);
    if (elements.length === 0) return invalid(DESIGN_IMPORT_MESSAGE.noLayers);
    return {
      ok: true,
      design: {
        format: DesignImportFormat.Psd,
        width: document.width,
        height: document.height,
        elements,
        buffers: context.buffers,
        notes: notesOf(context.counters, document),
      },
    };
  } catch (error) {
    if (error instanceof MemoryLimitError) return invalid(DESIGN_IMPORT_MESSAGE.memory);
    throw error;
  }
};

const readHead = async (file: File): Promise<Uint8Array> =>
  new Uint8Array(await file.slice(0, PSD_HEADER_BYTES).arrayBuffer());

const asDocument = (result: Result<{ design: ImportedDesign }>): Result<ImportKindResult> =>
  result.ok ? { ok: true, kind: DesignImportKind.Document, design: result.design } : result;

const decodeInWorker = async ({
  file,
  newId,
  capacityElements,
  usedBytes,
  signal,
}: WorkerImportInput): Promise<Result<ImportKindResult>> => {
  const header = readPsdHeader(await readHead(file));
  if (!header.ok) return header;
  try {
    const job = startImportJob(
      { file, format: DesignImportFormat.Psd, limits: { capacityElements, usedBytes } },
      { signal },
    );
    const outcome = await job.result;
    if (!outcome.ok) return outcome;
    const budgetBytes = DESIGN_LIMITS.rasterBudgetBytes - usedBytes;
    return asDocument(psdToDesign(outcome.document, { newId, budgetBytes }));
  } catch (error) {
    if (error instanceof ImportCancelledError) return IMPORT_CANCELLED;
    throw error;
  }
};

export const psdHandler: ImportHandler = {
  format: DesignImportFormat.Psd,
  kind: DesignImportKind.Document,
  extensions: ["psd"],
  maxBytes: 100 * 1024 * 1024,
  runsIn: "worker",
  sniff: hasPsdSignature,
  decode: decodeInWorker,
};
