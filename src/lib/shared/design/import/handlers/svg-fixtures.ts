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

const parseTree = (text: string): MutableNode | null => {
  const stack: MutableNode[] = [];
  let root: MutableNode | null = null;
  for (const match of text.matchAll(TOKEN)) {
    const [, cdata, closing, opening, attributeSource, selfClosing, chars] = match;
    const top = stack[stack.length - 1];
    if (cdata !== undefined && top !== undefined) top.textContent += cdata;
    else if (chars !== undefined && top !== undefined) top.textContent += decodeEntities(chars);
    else if (closing !== undefined) {
      if (stack.pop() === undefined) return null;
    } else if (opening !== undefined) {
      const attributes = readAttributes(attributeSource ?? "");
      const colon = opening.lastIndexOf(":");
      const node: MutableNode = {
        localName: colon < 0 ? opening : opening.slice(colon + 1),
        namespaceURI: namespaceOf(attributes, top?.namespaceURI ?? null),
        attributes,
        children: [],
        textContent: "",
      };
      if (top === undefined) {
        if (root !== null) return null;
        root = node;
      } else top.children.push(node);
      if (selfClosing !== "/") stack.push(node);
    }
  }
  return stack.length === 0 ? root : null;
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
