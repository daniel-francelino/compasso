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

const ANIMATION_PREFIX = "animate";
const EVENT_ATTRIBUTE_PREFIX = "on";
const XML_BASE = "xml:base";
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
const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]*$/i;
const LENGTH = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?(px)?$/i;
const VIEWBOX_SEPARATOR = /[\s,]+/;
const URL_OPEN = "url(";
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

const isAllowedReference = (reference: string): boolean => {
  const trimmed = reference.trim();
  return trimmed.startsWith("#") || DATA_IMAGE.test(trimmed);
};

const urlTargets = (lower: string): string[] => {
  const targets: string[] = [];
  let from = lower.indexOf(URL_OPEN);
  while (from >= 0) {
    const start = from + URL_OPEN.length;
    const end = lower.indexOf(")", start);
    const inner = lower.slice(start, end < 0 ? lower.length : end).trim();
    targets.push(inner.replace(/^["']+/, "").replace(/["']+$/, ""));
    from = lower.indexOf(URL_OPEN, start);
  }
  return targets;
};

const cssIsRisky = (text: string): boolean => {
  const lower = text.toLowerCase();
  if (FORBIDDEN_CSS.some((token) => lower.includes(token))) return true;
  return urlTargets(lower).some((target) => !isAllowedReference(target));
};

const attributeIsRisky = (attribute: SvgAttribute): boolean => {
  const name = attribute.name.toLowerCase();
  const local = attribute.localName.toLowerCase();
  if (local.startsWith(EVENT_ATTRIBUTE_PREFIX) || name === XML_BASE) return true;
  if (hasScriptScheme(attribute.value)) return true;
  if (attribute.value.length > SVG_LIMITS.maxStyleChars) return true;
  if (local === HREF && !isAllowedReference(attribute.value)) return true;
  return cssIsRisky(attribute.value);
};

const elementIsDenied = (localName: string): boolean => {
  const lower = localName.toLowerCase();
  return DENIED_ELEMENTS.has(lower) || lower.startsWith(ANIMATION_PREFIX);
};

const styleTextIsRisky = (node: SvgNode): boolean => {
  const text = node.textContent ?? "";
  return text.length > SVG_LIMITS.maxStyleChars || cssIsRisky(text);
};

type Walk = { elements: number; uses: number; texts: number };

const walkTree = (root: SvgNode): Result<{ texts: number }> => {
  const counts: Walk = { elements: 0, uses: 0, texts: 0 };
  const stack: { node: SvgNode; depth: number }[] = [{ node: root, depth: 1 }];
  for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) {
    const { node, depth } = entry;
    counts.elements += 1;
    const local = node.localName.toLowerCase();
    if (local === USE_ELEMENT) counts.uses += 1;
    if (local === TEXT_ELEMENT) counts.texts += 1;
    if (
      counts.elements > SVG_LIMITS.maxElements ||
      counts.uses > SVG_LIMITS.maxUse ||
      depth > SVG_LIMITS.maxDepth
    ) {
      return refuse(DESIGN_IMPORT_MESSAGE.svgTooComplex);
    }
    if (elementIsDenied(node.localName)) return blocked();
    if (local === STYLE_ELEMENT && styleTextIsRisky(node)) return blocked();
    for (let index = 0; index < node.attributes.length; index += 1) {
      const attribute = node.attributes[index];
      if (attribute === undefined || attributeIsRisky(attribute)) return blocked();
    }
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child !== undefined) stack.push({ node: child, depth: depth + 1 });
    }
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

const markupIsBlocked = (text: string): boolean => {
  const lower = text.toLowerCase();
  return FORBIDDEN_MARKUP.some((token) => lower.includes(token)) || DOCTYPE_WITH_SUBSET.test(lower);
};

export const gateSvg = (bytes: Uint8Array, parse: SvgParser): Result<{ svg: GatedSvg }> => {
  if (bytes.length > SVG_LIMITS.maxFileBytes) {
    return refuse(DESIGN_IMPORT_MESSAGE.tooLarge(SVG_LIMITS.maxFileBytes));
  }
  if (bytes.includes(0)) return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
  const text = decodeUtf8(bytes);
  if (text === null) return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
  if (markupIsBlocked(text)) return blocked();
  const document = parse(text);
  const root = document?.root ?? null;
  if (document === null || root === null) return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
  if (root.localName !== "svg" || root.namespaceURI !== SVG_NAMESPACE) {
    return refuse(DESIGN_IMPORT_MESSAGE.svgInvalid);
  }
  const walked = walkTree(root);
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
