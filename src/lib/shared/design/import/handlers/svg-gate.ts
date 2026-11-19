import { readGifInfo } from "@/lib/shared/design/import/handlers/gif-header";
import { readImageHeader } from "@/lib/shared/design/import/handlers/image-header";
import { MAX_DECLARED_PIXELS } from "@/lib/shared/design/import/handlers/image-remap";
import { DesignImportFormat } from "@/lib/shared/design/import/types";
import { SVG_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { type Result, invalid } from "@/lib/shared/server-utils";

export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type SvgAttribute = { name: string; localName: string; value: string };

export type SvgNode = {
  localName: string;
  namespaceURI: string | null;
  attributes: ArrayLike<SvgAttribute>;
  children: ArrayLike<SvgNode>;
  textContent: string | null;
};

export type SvgDocument = {
  root: SvgNode | null;
  setRootSize: (width: number, height: number) => void;
  serialize: () => string;
};

export type SvgParser = (text: string) => SvgDocument | null;

export type SvgSize = { width: number; height: number };

export type GatedSvg = {
  document: SvgDocument;
  size: SvgSize;
  explicitSize: boolean;
  textCount: number;
};

const DENIED_ELEMENTS: ReadonlySet<string> = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "handler",
  "listener",
  "set",
  "discard",
  "feimage",
  "parsererror",
]);

const ANIMATION_PREFIX = "animat";
const EVENT_ATTRIBUTE_PREFIX = "on";
const XML_BASE = "xml:base";
const XML_ID = "xml:id";
const USE_ELEMENT = "use";
const STYLE_ELEMENT = "style";
const TEXT_ELEMENT = "text";
const HREF = "href";
const SCRIPT_SCHEMES = ["javascript:", "vbscript:"];
const FORBIDDEN_CSS = [
  "@import",
  "expression(",
  "image-set(",
  "cross-fade(",
  "element(",
  "src(",
  "\\",
];
const FORBIDDEN_MARKUP = ["<!entity", "<!element", "<!attlist", "<!notation", "<?xml-stylesheet"];
const DOCTYPE_WITH_SUBSET = /<!doctype[^>]*\[/;
const DOCTYPE_WITH_EXTERNAL_ID = /<!doctype[^>]*\b(?:system|public)\b/;
const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]*$/i;
const LENGTH = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?(px)?$/i;
const VIEWBOX_SEPARATOR = /[\s,]+/;
const URL_OPEN = /url\(/gi;
const LAST_CONTROL_OR_SPACE = 0x20;
const DELETE_CHARACTER = 0x7f;
const VIEWBOX_VALUES = 4;

const refuse = (message: string) => invalid(message);

const blocked = () => refuse(DESIGN_IMPORT_MESSAGE.svgBlockedContent);

const stripSpacing = (value: string): string => {
  let out = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > LAST_CONTROL_OR_SPACE && code !== DELETE_CHARACTER) out += value[index];
  }
  return out;
};

const hasScriptScheme = (value: string): boolean => {
  const compact = stripSpacing(value).toLowerCase();
  return SCRIPT_SCHEMES.some((scheme) => compact.includes(scheme));
};

const DATA_IMAGE_HEAD_CHARS = 262_144;
const BASE64_QUANTUM = 4;
const DATA_PREFIX = /^data:image\/(png|jpeg|webp|gif);base64,/i;

const decodeHead = (payload: string): Uint8Array | null => {
  const compact = payload.replace(/\s+/g, "");
  const usable = compact.slice(0, DATA_IMAGE_HEAD_CHARS);
  const aligned = usable.slice(0, usable.length - (usable.length % BASE64_QUANTUM));
  try {
    return Uint8Array.from(atob(aligned), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
};

const FORMAT_OF_KIND: Record<string, DesignImportFormat> = {
  png: DesignImportFormat.Png,
  jpeg: DesignImportFormat.Jpeg,
  webp: DesignImportFormat.Webp,
};

const declaredSize = (kind: string, bytes: Uint8Array): SvgSize | null => {
  if (kind === "gif") return readGifInfo(bytes);
  const format = FORMAT_OF_KIND[kind];
  if (format === undefined) return null;
  const header = readImageHeader(bytes, format);
  return header.ok ? header.header : null;
};

type PixelBudget = { declared: number };

const dataImageFits = (uri: string, budget: PixelBudget): boolean => {
  const prefix = DATA_PREFIX.exec(uri);
  if (prefix === null) return false;
  const bytes = decodeHead(uri.slice(prefix[0].length));
  const size = bytes === null ? null : declaredSize((prefix[1] ?? "").toLowerCase(), bytes);
  if (size === null) return false;
  budget.declared += size.width * size.height;
  return budget.declared <= MAX_DECLARED_PIXELS;
};

const isAllowedReference = (reference: string, budget: PixelBudget): boolean => {
  const trimmed = reference.trim();
  if (trimmed.startsWith("#")) return true;
  return DATA_IMAGE.test(trimmed) && dataImageFits(trimmed, budget);
};

const urlTargets = (text: string): string[] => {
  const targets: string[] = [];
  for (const match of text.matchAll(URL_OPEN)) {
    const start = match.index + match[0].length;
    const end = text.indexOf(")", start);
    const inner = text.slice(start, end < 0 ? text.length : end).trim();
    targets.push(inner.replace(/^["']+/, "").replace(/["']+$/, ""));
  }
  return targets;
};

const cssIsRisky = (text: string, budget: PixelBudget): boolean => {
  const lower = text.toLowerCase();
  if (FORBIDDEN_CSS.some((token) => lower.includes(token))) return true;
  return urlTargets(text).some((target) => !isAllowedReference(target, budget));
};

const attributeIsRisky = (attribute: SvgAttribute, budget: PixelBudget): boolean => {
  const name = attribute.name.toLowerCase();
  const local = attribute.localName.toLowerCase();
  if (local.startsWith(EVENT_ATTRIBUTE_PREFIX) || name === XML_BASE) return true;
  if (hasScriptScheme(attribute.value)) return true;
  if (attribute.value.length > SVG_LIMITS.maxStyleChars) return true;
  if (local === HREF && !isAllowedReference(attribute.value, budget)) return true;
  return cssIsRisky(attribute.value, budget);
};

const elementIsDenied = (localName: string): boolean => {
  const lower = localName.toLowerCase();
  return DENIED_ELEMENTS.has(lower) || lower.startsWith(ANIMATION_PREFIX);
};

const styleTextIsRisky = (node: SvgNode, budget: PixelBudget): boolean => {
  const text = node.textContent ?? "";
  return text.length > SVG_LIMITS.maxStyleChars || cssIsRisky(text, budget);
};

type Walk = { elements: number; uses: number; texts: number };

type Indexed = { ids: Map<string, SvgNode>; uses: SvgNode[] };

type SubtreeStats = { size: number; hasUse: boolean };

const decodeFragment = (fragment: string): string => {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
};

const hrefCount = (node: SvgNode): number => {
  let count = 0;
  for (let index = 0; index < node.attributes.length; index += 1) {
    if (node.attributes[index]?.localName.toLowerCase() === HREF) count += 1;
  }
  return count;
};

const fragmentOf = (node: SvgNode): string | null => {
  for (let index = 0; index < node.attributes.length; index += 1) {
    const attribute = node.attributes[index];
    const value = attribute?.localName.toLowerCase() === HREF ? attribute.value.trim() : "";
    if (value.startsWith("#")) return decodeFragment(value.slice(1));
  }
  return null;
};

const subtreeStats = (start: SvgNode): SubtreeStats => {
  const stats: SubtreeStats = { size: 0, hasUse: false };
  const stack: SvgNode[] = [start];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    stats.size += 1;
    if (node.localName.toLowerCase() === USE_ELEMENT) stats.hasUse = true;
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child !== undefined) stack.push(child);
    }
  }
  return stats;
};

const reuseExpansionTooBig = (indexed: Indexed, elements: number): boolean => {
  const memo = new Map<SvgNode, SubtreeStats>();
  let expanded = elements;
  for (const use of indexed.uses) {
    const fragment = fragmentOf(use);
    const target = fragment === null ? undefined : indexed.ids.get(fragment);
    if (target === undefined) continue;
    const stats = memo.get(target) ?? subtreeStats(target);
    memo.set(target, stats);
    expanded += stats.size;
    if (stats.hasUse || expanded > SVG_LIMITS.maxElements) return true;
  }
  return false;
};

const registerIds = (indexed: Indexed, node: SvgNode): boolean => {
  for (let index = 0; index < node.attributes.length; index += 1) {
    const attribute = node.attributes[index];
    if (attribute?.name !== "id" && attribute?.name !== XML_ID) continue;
    if (indexed.ids.has(attribute.value)) return false;
    indexed.ids.set(attribute.value, node);
  }
  return true;
};

const walkTree = (root: SvgNode, budget: PixelBudget): Result<{ texts: number }> => {
  const counts: Walk = { elements: 0, uses: 0, texts: 0 };
  const indexed: Indexed = { ids: new Map(), uses: [] };
  const stack: { node: SvgNode; depth: number }[] = [{ node: root, depth: 1 }];
  for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) {
    const { node, depth } = entry;
    counts.elements += 1;
    const local = node.localName.toLowerCase();
    if (local === USE_ELEMENT) {
      counts.uses += 1;
      indexed.uses.push(node);
    }
    if (!registerIds(indexed, node)) return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
    if (local === USE_ELEMENT && hrefCount(node) > 1) {
      return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
    }
    if (local === TEXT_ELEMENT) counts.texts += 1;
    if (
      counts.elements > SVG_LIMITS.maxElements ||
      counts.uses > SVG_LIMITS.maxUse ||
      depth > SVG_LIMITS.maxDepth
    ) {
      return refuse(DESIGN_IMPORT_MESSAGE.svgTooComplex);
    }
    if (elementIsDenied(node.localName)) return blocked();
    if (local === STYLE_ELEMENT && styleTextIsRisky(node, budget)) return blocked();
    for (let index = 0; index < node.attributes.length; index += 1) {
      const attribute = node.attributes[index];
      if (attribute === undefined || attributeIsRisky(attribute, budget)) return blocked();
    }
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child !== undefined) stack.push({ node: child, depth: depth + 1 });
    }
  }
  if (reuseExpansionTooBig(indexed, counts.elements)) {
    return refuse(DESIGN_IMPORT_MESSAGE.svgTooComplex);
  }
  return { ok: true, texts: counts.texts };
};

const parseLength = (value: string | null): number | null => {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!LENGTH.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(/px$/i, ""));
  return Number.isFinite(parsed) && parsed > 0 && parsed <= SVG_LIMITS.maxDeclaredSide
    ? parsed
    : null;
};

const parseViewBox = (value: string | null): SvgSize | null => {
  if (value === null) return null;
  const parts = value.trim().split(VIEWBOX_SEPARATOR).map(Number);
  if (parts.length !== VIEWBOX_VALUES || !parts.every(Number.isFinite)) return null;
  const [, , width, height] = parts;
  if (width === undefined || height === undefined) return null;
  const inRange = (side: number): boolean => side > 0 && side <= SVG_LIMITS.maxDeclaredSide;
  return inRange(width) && inRange(height) ? { width, height } : null;
};

const attributeOf = (node: SvgNode, name: string): string | null => {
  for (let index = 0; index < node.attributes.length; index += 1) {
    const attribute = node.attributes[index];
    if (attribute !== undefined && attribute.name === name) return attribute.value;
  }
  return null;
};

export const readSvgSize = (root: SvgNode): { size: SvgSize; explicit: boolean } | null => {
  const width = parseLength(attributeOf(root, "width"));
  const height = parseLength(attributeOf(root, "height"));
  if (width !== null && height !== null) return { size: { width, height }, explicit: true };
  const box = parseViewBox(attributeOf(root, "viewBox"));
  if (box === null) return null;
  if (width !== null)
    return { size: { width, height: (width * box.height) / box.width }, explicit: false };
  if (height !== null)
    return { size: { width: (height * box.width) / box.height, height }, explicit: false };
  return { size: box, explicit: false };
};

const decodeUtf8 = (bytes: Uint8Array): string | null => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
};

const XML_ENCODING = /^\s*<\?xml[^>]*?\sencoding\s*=\s*["']([^"']*)["']/i;

const encodingIsNotUtf8 = (text: string): boolean => {
  const declared = XML_ENCODING.exec(text)?.[1];
  return declared !== undefined && declared.trim().toLowerCase() !== "utf-8";
};

const markupIsBlocked = (text: string): boolean => {
  const lower = text.toLowerCase();
  return (
    FORBIDDEN_MARKUP.some((token) => lower.includes(token)) ||
    DOCTYPE_WITH_SUBSET.test(lower) ||
    DOCTYPE_WITH_EXTERNAL_ID.test(lower)
  );
};

export const gateSvg = (bytes: Uint8Array, parse: SvgParser): Result<{ svg: GatedSvg }> => {
  if (bytes.length > SVG_LIMITS.maxFileBytes) {
    return refuse(DESIGN_IMPORT_MESSAGE.tooLarge(SVG_LIMITS.maxFileBytes));
  }
  if (bytes.includes(0)) return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
  const text = decodeUtf8(bytes);
  if (text === null) return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
  if (markupIsBlocked(text)) return blocked();
  if (encodingIsNotUtf8(text)) return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
  const document = parse(text);
  const root = document?.root ?? null;
  if (document === null || root === null) return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
  if (root.localName !== "svg" || root.namespaceURI !== SVG_NAMESPACE) {
    return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
  }
  const walked = walkTree(root, { declared: 0 });
  if (!walked.ok) return walked;
  const measured = readSvgSize(root);
  if (measured === null) return refuse(DESIGN_IMPORT_MESSAGE.svgNoSize);
  return {
    ok: true,
    svg: {
      document,
      size: measured.size,
      explicitSize: measured.explicit,
      textCount: walked.texts,
    },
  };
};
