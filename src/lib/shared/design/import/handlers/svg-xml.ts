import { SVG_VECTOR_LIMITS } from "@/lib/shared/design/import/limits";
import {
  type Deadline,
  type XmlElement,
  SvgFallback,
  checkDeadline,
  reject,
} from "@/lib/shared/design/import/handlers/svg-vector-types";

const NAME = /[A-Za-z_][\w:.-]*/y;
const NUMERIC_REFERENCE = /^&#(?:x([0-9a-fA-F]{1,6})|([0-9]{1,7}));$/;
const XML_DECLARATION = /^<\?xml[\s?]/;
const ENCODING = /encoding\s*=\s*["']([^"']*)["']/i;
const PREDEFINED: ReadonlyMap<string, string> = new Map(
  Object.entries({
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
  }),
);
const MAX_REFERENCE_LENGTH = 12;
const DATA_ATTRIBUTES: ReadonlySet<string> = new Set(["d", "points"]);
const TOKENS_PER_CLOCK_CHECK = 16;
const MAX_CODE_POINT = 0x10ffff;
const SURROGATE_FROM = 0xd800;
const SURROGATE_TO = 0xdfff;
const FIRST_PRINTABLE = 32;

const CODE_TAB = 9;
const CODE_LF = 10;
const CODE_CR = 13;
const CODE_SPACE = 32;
const CODE_BOM = 0xfeff;
const CODE_SLASH = 47;
const CODE_GT = 62;
const CODE_EQUALS = 61;
const CODE_DOUBLE = 34;
const CODE_SINGLE = 39;
const CODE_BANG = 33;
const CODE_QUESTION = 63;

const isSpace = (code: number): boolean =>
  code === CODE_SPACE || code === CODE_TAB || code === CODE_LF || code === CODE_CR;

const isAllowedCodePoint = (codePoint: number): boolean => {
  if (codePoint === CODE_TAB || codePoint === CODE_LF || codePoint === CODE_CR) return true;
  if (codePoint < FIRST_PRINTABLE || codePoint > MAX_CODE_POINT) return false;
  return codePoint < SURROGATE_FROM || codePoint > SURROGATE_TO;
};

const decodeReference = (reference: string): string => {
  const predefined = PREDEFINED.get(reference);
  if (predefined !== undefined) return predefined;
  const numeric = NUMERIC_REFERENCE.exec(reference);
  if (numeric === null) throw reject(SvgFallback.Unsupported);
  const [, hex, decimal] = numeric;
  const codePoint =
    hex === undefined ? Number.parseInt(decimal ?? "", 10) : Number.parseInt(hex, 16);
  if (!isAllowedCodePoint(codePoint)) throw reject(SvgFallback.Malformed);
  return String.fromCodePoint(codePoint);
};

export const decodeText = (raw: string): string => {
  if (!raw.includes("&")) return raw;
  const parts: string[] = [];
  let index = 0;
  while (index < raw.length) {
    const amp = raw.indexOf("&", index);
    if (amp < 0) {
      parts.push(raw.slice(index));
      break;
    }
    parts.push(raw.slice(index, amp));
    const semi = raw.indexOf(";", amp);
    if (semi < 0 || semi - amp > MAX_REFERENCE_LENGTH) throw reject(SvgFallback.Unsupported);
    parts.push(decodeReference(raw.slice(amp, semi + 1)));
    index = semi + 1;
  }
  return parts.join("");
};

type Scan = {
  text: string;
  index: number;
  nodes: number;
  tokens: number;
  root: XmlElement;
  stack: XmlElement[];
};

const top = (scan: Scan): XmlElement => scan.stack[scan.stack.length - 1] ?? scan.root;

const skipSpaces = (text: string, from: number): number => {
  let index = from;
  while (index < text.length && isSpace(text.charCodeAt(index))) index += 1;
  return index;
};

const readName = (text: string, from: number): string | null => {
  NAME.lastIndex = from;
  const match = NAME.exec(text);
  return match === null ? null : match[0];
};

const appendText = (scan: Scan, raw: string, decode: boolean): void => {
  const owner = top(scan);
  if (owner === scan.root && raw.trim() !== "") throw reject(SvgFallback.Malformed);
  const text = decode ? decodeText(raw) : raw;
  if (owner === scan.root || owner.name !== "style") return;
  owner.text += text;
  if (owner.text.length > SVG_VECTOR_LIMITS.maxStyleChars) {
    throw reject(SvgFallback.ParseLimit);
  }
};

const readUntil = (scan: Scan, terminator: string, from: number): number => {
  const end = scan.text.indexOf(terminator, from);
  if (end < 0) throw reject(SvgFallback.Malformed);
  return end;
};

const readDeclaration = (scan: Scan): void => {
  const { text, index } = scan;
  if (text.startsWith("<!--", index)) {
    scan.index = readUntil(scan, "-->", index + 4) + 3;
    return;
  }
  if (text.startsWith("<![CDATA[", index)) {
    const end = readUntil(scan, "]]>", index + 9);
    appendText(scan, text.slice(index + 9, end), false);
    scan.index = end + 3;
    return;
  }
  throw reject(SvgFallback.Unsupported);
};

const checkEncoding = (declaration: string): void => {
  const encoding = ENCODING.exec(declaration);
  const name = encoding?.[1]?.toLowerCase();
  if (name !== undefined && name !== "utf-8" && name !== "us-ascii") {
    throw reject(SvgFallback.Unsupported);
  }
};

const readInstruction = (scan: Scan): void => {
  const { text, index } = scan;
  const end = readUntil(scan, "?>", index);
  const declared = XML_DECLARATION.test(text.slice(index, index + 7));
  const atStart = index === (text.charCodeAt(0) === CODE_BOM ? 1 : 0);
  if (!declared || !atStart) throw reject(SvgFallback.Unsupported);
  checkEncoding(text.slice(index, end));
  scan.index = end + 2;
};

const readClosing = (scan: Scan): void => {
  const { text, index } = scan;
  const name = readName(text, index + 2);
  if (name === null) throw reject(SvgFallback.Malformed);
  const after = skipSpaces(text, index + 2 + name.length);
  if (text.charCodeAt(after) !== CODE_GT) throw reject(SvgFallback.Malformed);
  const closed = scan.stack.pop();
  if (closed === undefined || closed.name !== name) throw reject(SvgFallback.Malformed);
  scan.index = after + 1;
};

const readAttribute = (scan: Scan, element: XmlElement, from: number): number => {
  const { text } = scan;
  const name = readName(text, from);
  if (name === null) throw reject(SvgFallback.Malformed);
  const equals = skipSpaces(text, from + name.length);
  if (text.charCodeAt(equals) !== CODE_EQUALS) throw reject(SvgFallback.Malformed);
  const open = skipSpaces(text, equals + 1);
  const quote = text.charCodeAt(open);
  if (quote !== CODE_DOUBLE && quote !== CODE_SINGLE) throw reject(SvgFallback.Malformed);
  const close = text.indexOf(String.fromCharCode(quote), open + 1);
  if (close < 0) throw reject(SvgFallback.Malformed);
  const limit = DATA_ATTRIBUTES.has(name)
    ? SVG_VECTOR_LIMITS.maxDataAttributeChars
    : SVG_VECTOR_LIMITS.maxAttributeChars;
  if (close - open - 1 > limit) throw reject(SvgFallback.ParseLimit);
  if (element.attrs.size >= SVG_VECTOR_LIMITS.maxAttributesPerElement) {
    throw reject(SvgFallback.ParseLimit);
  }
  const raw = text.slice(open + 1, close);
  if (raw.includes("<")) throw reject(SvgFallback.Malformed);
  if (element.attrs.has(name)) throw reject(SvgFallback.Malformed);
  element.attrs.set(name, decodeText(raw));
  return close + 1;
};

const attach = (scan: Scan, element: XmlElement, selfClosing: boolean): void => {
  scan.nodes += 1;
  if (scan.nodes > SVG_VECTOR_LIMITS.maxNodes) throw reject(SvgFallback.ParseLimit);
  const parent = top(scan);
  if (parent === scan.root && scan.root.children.length > 0) throw reject(SvgFallback.Malformed);
  parent.children.push(element);
  if (selfClosing) return;
  scan.stack.push(element);
  if (scan.stack.length > SVG_VECTOR_LIMITS.maxDepth) throw reject(SvgFallback.ParseLimit);
};

const readOpening = (scan: Scan): void => {
  const { text, index } = scan;
  const name = readName(text, index + 1);
  if (name === null) throw reject(SvgFallback.Malformed);
  const element: XmlElement = { name, attrs: new Map(), children: [], text: "" };
  let cursor = index + 1 + name.length;
  for (;;) {
    cursor = skipSpaces(text, cursor);
    if (cursor >= text.length) throw reject(SvgFallback.Malformed);
    const code = text.charCodeAt(cursor);
    if (code === CODE_GT) {
      attach(scan, element, false);
      scan.index = cursor + 1;
      return;
    }
    if (code === CODE_SLASH && text.charCodeAt(cursor + 1) === CODE_GT) {
      attach(scan, element, true);
      scan.index = cursor + 2;
      return;
    }
    cursor = readAttribute(scan, element, cursor);
  }
};

const readMarkup = (scan: Scan): void => {
  const next = scan.text.charCodeAt(scan.index + 1);
  if (next === CODE_BANG) return readDeclaration(scan);
  if (next === CODE_QUESTION) return readInstruction(scan);
  if (next === CODE_SLASH) return readClosing(scan);
  return readOpening(scan);
};

export const tokenizeSvg = (text: string, deadline: Deadline): XmlElement => {
  if (text.length > SVG_VECTOR_LIMITS.maxFileBytes) throw reject(SvgFallback.ParseLimit);
  const root: XmlElement = { name: "#root", attrs: new Map(), children: [], text: "" };
  const scan: Scan = {
    text,
    index: text.charCodeAt(0) === CODE_BOM ? 1 : 0,
    nodes: 0,
    tokens: 0,
    root,
    stack: [],
  };
  while (scan.index < text.length) {
    scan.tokens += 1;
    if (scan.tokens % TOKENS_PER_CLOCK_CHECK === 1) checkDeadline(deadline);
    const lt = text.indexOf("<", scan.index);
    const end = lt < 0 ? text.length : lt;
    if (end > scan.index) appendText(scan, text.slice(scan.index, end), true);
    if (lt < 0) break;
    scan.index = lt;
    readMarkup(scan);
  }
  if (scan.stack.length > 0 || root.children.length !== 1) throw reject(SvgFallback.Malformed);
  return root.children[0] ?? root;
};

const UTF16_LITTLE_ENDIAN = [0xff, 0xfe];
const UTF16_BIG_ENDIAN = [0xfe, 0xff];

const startsWithBytes = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((value, index) => bytes[index] === value);

export const decodeSvgBytes = (bytes: Uint8Array): string => {
  if (bytes.length > SVG_VECTOR_LIMITS.maxFileBytes) throw reject(SvgFallback.ParseLimit);
  if (startsWithBytes(bytes, UTF16_LITTLE_ENDIAN) || startsWithBytes(bytes, UTF16_BIG_ENDIAN)) {
    throw reject(SvgFallback.Unsupported);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw reject(SvgFallback.Malformed);
  }
};
