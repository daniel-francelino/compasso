import { z } from "zod";
import { SKETCH_LIMITS } from "@/lib/shared/design/import/limits";
import { sketchFailure } from "@/lib/shared/design/import/refusal";
import { SketchRefusal } from "@/lib/shared/design/import/types";
import { sanitizeImportName, sanitizeImportText } from "@/lib/shared/design/import/sanitize";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import type { ValueOf } from "@/lib/shared/utils";
import type { Result } from "@/lib/shared/server-utils";

export const SketchNodeKind = {
  Group: "group",
  Rectangle: "rectangle",
  Oval: "oval",
  Path: "path",
  Bitmap: "bitmap",
  Text: "text",
  Symbol: "symbol",
  Unsupported: "unsupported",
} as const;
export type SketchNodeKind = ValueOf<typeof SketchNodeKind>;

const MAX_STRING = 2000;
const MAX_ID = 64;
const MAX_CLASS = 64;
const MAX_CHILDREN = 5000;
const MAX_NODES_PER_ARTBOARD = 5000;
const MAX_POINTS = 2000;
const MAX_TEXT = 10_000;
const MAX_EXTENT = 1_000_000;
const MAX_ROTATION = 3600;
const MAX_ATTRIBUTES = 200;
const MAX_FILLS = 64;
const MAX_REF = 200;
const POINT_STRING_MAX = 64;
const PAGE_REF = /^pages\/[A-Za-z0-9-]{1,64}$/;
const IMAGE_REF = /^images\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/;
const COLOR_STEPS = 255;
const UNSAFE_KEY = "__proto__";
const QUOTE = 34;
const BACKSLASH_CODE = 92;
const OPEN_BRACE = 123;
const OPEN_BRACKET = 91;
const CLOSE_BRACE = 125;
const CLOSE_BRACKET = 93;
const FILL_COLOR = 0;

const CLASS = {
  artboard: "artboard",
  group: "group",
  rectangle: "rectangle",
  oval: "oval",
  shapePath: "shapePath",
  bitmap: "bitmap",
  text: "text",
  symbolInstance: "symbolInstance",
  page: "page",
} as const;

export type SketchRgba = { r: number; g: number; b: number; a: number };
export type SketchFrame = { x: number; y: number; width: number; height: number };
export type SketchPathPoint = {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  curved: boolean;
};

export type SketchNode = {
  kind: SketchNodeKind;
  id: string;
  name: string;
  depth: number;
  visible: boolean;
  opacity: number;
  frame: SketchFrame;
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  fill: SketchRgba | null;
  radius: number;
  points: SketchPathPoint[];
  closed: boolean;
  imageRef: string | null;
  text: { value: string; font: string | null; size: number; color: SketchRgba | null } | null;
  symbolId: string | null;
  droppedStyles: number;
  droppedOverrides: number;
};

export type SketchArtboardInfo = {
  pageIndex: number;
  artboardIndex: number;
  id: string;
  name: string;
  width: number;
  height: number;
};

export type SketchArtboard = {
  info: SketchArtboardInfo;
  background: SketchRgba | null;
  nodes: SketchNode[];
  deepGroups: number;
};

const corrupt = (): Result<never> => sketchFailure(SketchRefusal.Corrupt);

const finite = z.number().finite();
const unit = finite.min(0).max(1);
const extent = finite.min(-MAX_EXTENT).max(MAX_EXTENT);
const frameSchema = z.object({
  x: extent,
  y: extent,
  width: finite.min(0).max(MAX_EXTENT),
  height: finite.min(0).max(MAX_EXTENT),
});
const colorSchema = z.object({ red: unit, green: unit, blue: unit, alpha: unit });
const idSchema = z.string().max(MAX_ID);
const nameSchema = z.string().max(MAX_STRING);
const toggle = z.object({ isEnabled: z.boolean().default(true) });
const fillSchema = z.object({
  isEnabled: z.boolean().default(true),
  fillType: finite.int().min(0).max(16).default(FILL_COLOR),
  color: colorSchema.optional(),
});
const styleSchema = z.object({
  contextSettings: z.object({ opacity: unit.default(1) }).optional(),
  fills: z.array(fillSchema).max(MAX_FILLS).default([]),
  borders: z.array(toggle).max(MAX_FILLS).default([]),
  shadows: z.array(toggle).max(MAX_FILLS).default([]),
  innerShadows: z.array(toggle).max(MAX_FILLS).default([]),
  blur: toggle.optional(),
});
const pointSchema = z.object({
  point: z.string().max(POINT_STRING_MAX),
  curveFrom: z.string().max(POINT_STRING_MAX).optional(),
  curveTo: z.string().max(POINT_STRING_MAX).optional(),
  curveMode: finite.int().min(0).max(8).default(0),
});
const textAttributeSchema = z.object({
  attributes: z
    .object({
      MSAttributedStringFontAttribute: z
        .object({
          attributes: z
            .object({
              name: z.string().max(MAX_STRING).optional(),
              size: finite.min(1).max(MAX_EXTENT).optional(),
            })
            .optional(),
        })
        .optional(),
      MSAttributedStringColorAttribute: colorSchema.optional(),
    })
    .optional(),
});

const baseShape = {
  _class: z.string().max(MAX_CLASS),
  do_objectID: idSchema.default(""),
  name: nameSchema.default(""),
  isVisible: z.boolean().default(true),
  frame: frameSchema,
  rotation: finite.min(-MAX_ROTATION).max(MAX_ROTATION).default(0),
  isFlippedHorizontal: z.boolean().default(false),
  isFlippedVertical: z.boolean().default(false),
  style: styleSchema.optional(),
  layers: z.array(z.unknown()).max(MAX_CHILDREN).default([]),
};

const SCHEMA_BY_CLASS: Record<string, z.ZodTypeAny> = {
  [CLASS.group]: z.object(baseShape),
  [CLASS.rectangle]: z.object({
    ...baseShape,
    fixedRadius: finite.min(0).max(MAX_EXTENT).default(0),
  }),
  [CLASS.oval]: z.object(baseShape),
  [CLASS.shapePath]: z.object({
    ...baseShape,
    isClosed: z.boolean().default(true),
    points: z.array(pointSchema).max(MAX_POINTS).default([]),
  }),
  [CLASS.bitmap]: z.object({ ...baseShape, image: z.object({ _ref: z.string().max(MAX_REF) }) }),
  [CLASS.text]: z.object({
    ...baseShape,
    attributedString: z.object({
      string: z.string().max(MAX_TEXT),
      attributes: z.array(textAttributeSchema).max(MAX_ATTRIBUTES).default([]),
    }),
  }),
  [CLASS.symbolInstance]: z.object({
    ...baseShape,
    symbolID: idSchema,
    overrideValues: z.array(z.unknown()).max(MAX_CHILDREN).default([]),
  }),
};

const catchAllSchema = z.object({
  _class: z.string().max(MAX_CLASS),
  do_objectID: idSchema.default(""),
  name: nameSchema.default(""),
  frame: frameSchema.optional(),
});

const KIND_BY_CLASS: Record<string, SketchNodeKind> = {
  [CLASS.group]: SketchNodeKind.Group,
  [CLASS.rectangle]: SketchNodeKind.Rectangle,
  [CLASS.oval]: SketchNodeKind.Oval,
  [CLASS.shapePath]: SketchNodeKind.Path,
  [CLASS.bitmap]: SketchNodeKind.Bitmap,
  [CLASS.text]: SketchNodeKind.Text,
  [CLASS.symbolInstance]: SketchNodeKind.Symbol,
};

const artboardSchema = z.object({
  _class: z.literal(CLASS.artboard),
  do_objectID: idSchema.default(""),
  name: nameSchema.default(""),
  frame: frameSchema,
  hasBackgroundColor: z.boolean().default(false),
  backgroundColor: colorSchema.optional(),
  layers: z.array(z.unknown()).max(MAX_CHILDREN).default([]),
});

const pageSchema = z.object({
  _class: z.literal(CLASS.page),
  layers: z.array(z.unknown()).max(MAX_CHILDREN).default([]),
});

const metaSchema = z.object({ version: finite.int().min(0).max(1_000_000) });

const documentSchema = z.object({
  pages: z
    .array(z.object({ _ref: z.string().regex(PAGE_REF) }))
    .min(1)
    .max(SKETCH_LIMITS.maxEntries),
});

const classOf = z.object({ _class: z.string().max(MAX_CLASS) });

type Scan = { depth: number; inString: boolean; escaped: boolean };

const DEPTH_DELTA = new Map<number, number>([
  [OPEN_BRACE, 1],
  [OPEN_BRACKET, 1],
  [CLOSE_BRACE, -1],
  [CLOSE_BRACKET, -1],
]);

const stepInString = (scan: Scan, code: number): void => {
  if (scan.escaped) {
    scan.escaped = false;
    return;
  }
  if (code === BACKSLASH_CODE) {
    scan.escaped = true;
    return;
  }
  if (code === QUOTE) scan.inString = false;
};

const stepOutside = (scan: Scan, code: number): void => {
  if (code === QUOTE) {
    scan.inString = true;
    return;
  }
  scan.depth += DEPTH_DELTA.get(code) ?? 0;
};

const jsonDepthOk = (text: string): boolean => {
  const scan: Scan = { depth: 0, inString: false, escaped: false };
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (scan.inString) stepInString(scan, code);
    else stepOutside(scan, code);
    if (scan.depth > SKETCH_LIMITS.maxJsonDepth) return false;
  }
  return true;
};

const childrenOf = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "object" || value === null) return [];
  return Object.keys(value).includes(UNSAFE_KEY) ? null : Object.values(value);
};

export type JsonValueBudget = { remaining: number };

export const newJsonValueBudget = (): JsonValueBudget => ({
  remaining: SKETCH_LIMITS.maxJobJsonValues,
});

const walkIsSafe = (root: unknown, budget: JsonValueBudget | undefined): boolean => {
  const stack: unknown[] = [root];
  const cap = Math.min(SKETCH_LIMITS.maxJsonValues, budget?.remaining ?? Infinity);
  let values = 0;
  while (stack.length > 0) {
    values += 1;
    if (values > cap) return false;
    const children = childrenOf(stack.pop());
    if (children === null) return false;
    for (const child of children) stack.push(child);
  }
  if (budget !== undefined) budget.remaining -= values;
  return true;
};

export const parseSketchJson = (
  data: Uint8Array,
  budget?: JsonValueBudget,
): Result<{ value: unknown }> => {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    if (!jsonDepthOk(text)) return corrupt();
    const value: unknown = JSON.parse(text);
    return walkIsSafe(value, budget) ? { ok: true, value } : corrupt();
  } catch {
    return corrupt();
  }
};

export const parseSketchMeta = (value: unknown): Result<{ version: number }> => {
  const parsed = metaSchema.safeParse(value);
  if (!parsed.success) return corrupt();
  if (parsed.data.version < SKETCH_LIMITS.minFormatVersion) {
    return sketchFailure(SketchRefusal.UnsupportedVersion);
  }
  return { ok: true, version: parsed.data.version };
};

export const parseSketchDocument = (value: unknown): Result<{ pageEntries: string[] }> => {
  const parsed = documentSchema.safeParse(value);
  if (!parsed.success) return corrupt();
  return {
    ok: true,
    pageEntries: [...new Set(parsed.data.pages.map((page) => `${page._ref}.json`))],
  };
};

const toRgba = (color: z.infer<typeof colorSchema>): SketchRgba => ({
  r: Math.round(color.red * COLOR_STEPS),
  g: Math.round(color.green * COLOR_STEPS),
  b: Math.round(color.blue * COLOR_STEPS),
  a: color.alpha,
});

const parsePair = (raw: string | undefined): [number, number] | null => {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  const parts = trimmed.slice(1, -1).split(",");
  if (parts.length !== 2) return null;
  const [first, second] = parts.map((part) => Number(part.trim()));
  if (first === undefined || second === undefined) return null;
  return Number.isFinite(first) && Number.isFinite(second) ? [first, second] : null;
};

const toPathPoints = (points: z.infer<typeof pointSchema>[]): SketchPathPoint[] | null => {
  const converted: SketchPathPoint[] = [];
  for (const entry of points) {
    const anchor = parsePair(entry.point);
    if (anchor === null) return null;
    const from = parsePair(entry.curveFrom) ?? anchor;
    const to = parsePair(entry.curveTo) ?? anchor;
    converted.push({
      x: anchor[0],
      y: anchor[1],
      fromX: from[0],
      fromY: from[1],
      toX: to[0],
      toY: to[1],
      curved: entry.curveMode !== 1,
    });
  }
  return converted;
};

type Styled = { style?: z.infer<typeof styleSchema> | undefined };

const styleSummary = (
  layer: Styled,
): { fill: SketchRgba | null; opacity: number; dropped: number } => {
  const style = layer.style;
  if (style === undefined) return { fill: null, opacity: 1, dropped: 0 };
  const fills = style.fills.filter((entry) => entry.isEnabled);
  const solid = fills.find((entry) => entry.fillType === FILL_COLOR && entry.color !== undefined);
  const enabled = (list: { isEnabled: boolean }[]): number =>
    list.filter((entry) => entry.isEnabled).length;
  const dropped =
    enabled(style.borders) +
    enabled(style.shadows) +
    enabled(style.innerShadows) +
    (style.blur?.isEnabled === true ? 1 : 0) +
    Math.max(0, fills.length - (solid === undefined ? 0 : 1));
  return {
    fill: solid?.color === undefined ? null : toRgba(solid.color),
    opacity: style.contextSettings?.opacity ?? 1,
    dropped,
  };
};

type ParsedLayer = Record<string, unknown> & {
  _class: string;
  do_objectID: string;
  name: string;
  frame?: SketchFrame;
  isVisible?: boolean;
  rotation?: number;
  isFlippedHorizontal?: boolean;
  isFlippedVertical?: boolean;
  layers?: unknown[];
  fixedRadius?: number;
  isClosed?: boolean;
  points?: z.infer<typeof pointSchema>[];
  image?: { _ref: string };
  attributedString?: { string: string; attributes: z.infer<typeof textAttributeSchema>[] };
  symbolID?: string;
  overrideValues?: unknown[];
};

const EMPTY_FRAME: SketchFrame = { x: 0, y: 0, width: 0, height: 0 };

const textOf = (layer: ParsedLayer): SketchNode["text"] => {
  if (layer.attributedString === undefined) return null;
  const first = layer.attributedString.attributes[0]?.attributes;
  const color = first?.MSAttributedStringColorAttribute;
  const font = first?.MSAttributedStringFontAttribute?.attributes;
  return {
    value: sanitizeImportText(layer.attributedString.string, MAX_TEXT),
    font: font?.name === undefined ? null : sanitizeImportName(font.name),
    size: font?.size ?? 12,
    color: color === undefined ? null : toRgba(color),
  };
};

type Built = { node: SketchNode; children: unknown[] } | null;

const buildNode = (layer: ParsedLayer, kind: SketchNodeKind, depth: number): Built => {
  const style = styleSummary(layer as Styled);
  const points = toPathPoints(layer.points ?? []);
  if (points === null) return null;
  const imageRef = layer.image?._ref ?? null;
  return {
    node: {
      kind,
      id: layer.do_objectID,
      name: sanitizeImportName(layer.name),
      depth,
      visible: layer.isVisible ?? true,
      opacity: style.opacity,
      frame: layer.frame ?? EMPTY_FRAME,
      rotation: layer.rotation ?? 0,
      flipHorizontal: layer.isFlippedHorizontal ?? false,
      flipVertical: layer.isFlippedVertical ?? false,
      fill: style.fill,
      radius: layer.fixedRadius ?? 0,
      points,
      closed: layer.isClosed ?? true,
      imageRef: imageRef !== null && IMAGE_REF.test(imageRef) ? imageRef : null,
      text: textOf(layer),
      symbolId: layer.symbolID ?? null,
      droppedStyles: style.dropped,
      droppedOverrides: layer.overrideValues?.length ?? 0,
    },
    children: kind === SketchNodeKind.Group ? (layer.layers ?? []) : [],
  };
};

const parseLayer = (raw: unknown, depth: number): Built => {
  const named = classOf.safeParse(raw);
  if (!named.success) return null;
  const schema = SCHEMA_BY_CLASS[named.data._class];
  if (schema === undefined) {
    const loose = catchAllSchema.safeParse(raw);
    return loose.success
      ? buildNode(loose.data as ParsedLayer, SketchNodeKind.Unsupported, depth)
      : null;
  }
  const parsed = schema.safeParse(raw);
  const kind = KIND_BY_CLASS[named.data._class];
  return parsed.success && kind !== undefined
    ? buildNode(parsed.data as ParsedLayer, kind, depth)
    : null;
};

export const flattenLayers = (
  roots: readonly unknown[],
): Result<{ nodes: SketchNode[]; deepGroups: number }> => {
  const nodes: SketchNode[] = [];
  let deepGroups = 0;
  const stack: { raw: unknown; depth: number }[] = [...roots]
    .reverse()
    .map((raw) => ({ raw, depth: 0 }));
  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    if (nodes.length >= MAX_NODES_PER_ARTBOARD) {
      return sketchFailure(SketchRefusal.TooManyLayers, [DESIGN_LIMITS.maxElements]);
    }
    const built = parseLayer(item.raw, item.depth);
    if (built === null) return corrupt();
    nodes.push(built.node);
    if (built.node.kind === SketchNodeKind.Group && item.depth >= DESIGN_LIMITS.maxGroupDepth) {
      deepGroups += 1;
    }
    for (let index = built.children.length - 1; index >= 0; index -= 1) {
      stack.push({ raw: built.children[index], depth: item.depth + 1 });
    }
  }
  return { ok: true, nodes, deepGroups };
};

export type PageArtboards = { infos: SketchArtboardInfo[]; raws: unknown[] };

const readPage = (value: unknown, pageIndex: number): Result<PageArtboards> => {
  const page = pageSchema.safeParse(value);
  if (!page.success) return corrupt();
  const infos: SketchArtboardInfo[] = [];
  const raws: unknown[] = [];
  for (const layer of page.data.layers) {
    const artboard = artboardSchema.safeParse(layer);
    if (!artboard.success) continue;
    infos.push({
      pageIndex,
      artboardIndex: raws.length,
      id: artboard.data.do_objectID,
      name: sanitizeImportName(artboard.data.name),
      width: artboard.data.frame.width,
      height: artboard.data.frame.height,
    });
    raws.push(layer);
  }
  return { ok: true, infos, raws };
};

export const readSketchPage = readPage;

export type SketchPages = { pages: PageArtboards[] };

export const readSketchPages = (values: readonly unknown[]): Result<{ pages: SketchPages }> => {
  const pages: PageArtboards[] = [];
  for (const [index, value] of values.entries()) {
    const read = readPage(value, index);
    if (!read.ok) return read;
    pages.push(read);
  }
  return { ok: true, pages: { pages } };
};

export const listArtboards = (
  pages: SketchPages,
): { listed: SketchArtboardInfo[]; total: number } => {
  const all = pages.pages.flatMap((page) => page.infos);
  return { listed: all.slice(0, SKETCH_LIMITS.maxArtboardsListed), total: all.length };
};

export const readArtboard = (
  pages: SketchPages,
  info: SketchArtboardInfo,
): Result<{ artboard: SketchArtboard }> => readArtboardOfPage(pages.pages[info.pageIndex], info);

export const readArtboardOfPage = (
  page: PageArtboards | undefined,
  info: SketchArtboardInfo,
): Result<{ artboard: SketchArtboard }> => {
  const raw = page?.raws[info.artboardIndex];
  const parsed = artboardSchema.safeParse(raw);
  if (!parsed.success) return corrupt();
  const flat = flattenLayers(parsed.data.layers);
  if (!flat.ok) return flat;
  const background =
    parsed.data.hasBackgroundColor && parsed.data.backgroundColor !== undefined
      ? toRgba(parsed.data.backgroundColor)
      : null;
  return {
    ok: true,
    artboard: { info, background, nodes: flat.nodes, deepGroups: flat.deepGroups },
  };
};
