import type {
  SvgAttribute,
  SvgDocument,
  SvgNode,
  SvgParser,
} from "@/lib/shared/design/import/handlers/svg-gate";

type MutableNode = {
  localName: string;
  namespaceURI: string | null;
  attributes: SvgAttribute[];
  children: MutableNode[];
  textContent: string;
};

const NAMED: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return NAMED[body] ?? whole;
  });

const TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<[?!][^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
const ATTRIBUTE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const readAttributes = (source: string): SvgAttribute[] =>
  [...source.matchAll(ATTRIBUTE)].map((match) => {
    const name = match[1] ?? "";
    const colon = name.lastIndexOf(":");
    return {
      name,
      localName: colon < 0 ? name : name.slice(colon + 1),
      value: decodeEntities(match[2] ?? match[3] ?? ""),
    };
  });

const namespaceOf = (attributes: SvgAttribute[], parent: string | null): string | null =>
  attributes.find((attribute) => attribute.name === "xmlns")?.value ?? parent;

type ParseState = { stack: MutableNode[]; root: MutableNode | null };

const makeNode = (opening: string, attributeSource: string, parent: MutableNode | undefined) => {
  const attributes = readAttributes(attributeSource);
  const colon = opening.lastIndexOf(":");
  const node: MutableNode = {
    localName: colon < 0 ? opening : opening.slice(colon + 1),
    namespaceURI: namespaceOf(attributes, parent?.namespaceURI ?? null),
    attributes,
    children: [],
    textContent: "",
  };
  return node;
};

const attach = (state: ParseState, node: MutableNode): boolean => {
  const top = state.stack[state.stack.length - 1];
  if (top !== undefined) {
    top.children.push(node);
    return true;
  }
  if (state.root !== null) return false;
  state.root = node;
  return true;
};

const openNode = (state: ParseState, match: RegExpMatchArray): boolean => {
  const [, , , opening, attributeSource, selfClosing] = match;
  if (opening === undefined) return true;
  const node = makeNode(opening, attributeSource ?? "", state.stack[state.stack.length - 1]);
  if (!attach(state, node)) return false;
  if (selfClosing !== "/") state.stack.push(node);
  return true;
};

const addText = (state: ParseState, match: RegExpMatchArray): void => {
  const [, cdata, , , , , chars] = match;
  const top = state.stack[state.stack.length - 1];
  if (top === undefined) return;
  top.textContent += cdata ?? (chars === undefined ? "" : decodeEntities(chars));
};

const parseTree = (text: string): MutableNode | null => {
  const state: ParseState = { stack: [], root: null };
  for (const match of text.matchAll(TOKEN)) {
    if (match[2] !== undefined && state.stack.pop() === undefined) return null;
    if (!openNode(state, match)) return null;
    addText(state, match);
  }
  return state.stack.length === 0 ? state.root : null;
};

const escapeAttribute = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

const render = (node: MutableNode): string => {
  const attributes = node.attributes
    .map((attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`)
    .join("");
  const inner = node.children.map(render).join("");
  return `<${node.localName}${attributes}>${inner}</${node.localName}>`;
};

export const testSvgParser: SvgParser = (text) => {
  const root = parseTree(text);
  if (root === null) return null;
  const document: SvgDocument = {
    root: root as SvgNode,
    setRootSize: (width, height) => {
      for (const [name, value] of [
        ["width", String(width)],
        ["height", String(height)],
      ] as const) {
        const existing = root.attributes.find((attribute) => attribute.name === name);
        if (existing === undefined) root.attributes.push({ name, localName: name, value });
        else existing.value = value;
      }
    },
    serialize: () => render(root),
  };
  return document;
};

export const SVG_NS = "http://www.w3.org/2000/svg";

export const svg = (body = "", rootAttributes = 'width="100" height="100"'): string =>
  `<svg xmlns="${SVG_NS}" ${rootAttributes}>${body}</svg>`;

export const encodeText = (text: string): Uint8Array => new TextEncoder().encode(text);

export const pngDataUri = (width: number, height: number): string => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
};
