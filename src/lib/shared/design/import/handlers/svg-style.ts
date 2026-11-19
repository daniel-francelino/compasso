import { SVG_VECTOR_LIMITS } from "@/lib/shared/design/import/limits";
import {
  type Budget,
  SvgFallback,
  type XmlElement,
  reject,
  spend,
} from "@/lib/shared/design/import/handlers/svg-vector-types";
import {
  BLACK,
  NO_PAINT,
  SvgPaintKind,
  type SvgPaint,
  checkSafeValue,
  readLength,
  readNumber,
  readNumberList,
  readPaint,
  readSolidColor,
  readUnit,
} from "@/lib/shared/design/import/handlers/svg-values";
import { DesignPathCap, DesignPathFillRule, DesignPathJoin } from "@/lib/shared/design/types";

export type Declaration = readonly [string, string];

const PROPERTY_NAME = /^-?[a-z][a-z0-9-]*$/;
const SIMPLE_SELECTOR = /^(?:\.[A-Za-z_][\w-]*|#[A-Za-z_][\w-]*|[A-Za-z][\w-]*)$/;
const IMPORTANT = "important";
const WHITESPACE = /\s+/;
const MAX_CLASS_TOKENS = 32;
const MAX_DASH_ITEMS = 64;
const SPECIFICITY_TAG = 1;
const SPECIFICITY_CLASS = 10;
const SPECIFICITY_ID = 100;

export const PRESENTATION_PROPERTIES: ReadonlySet<string> = new Set([
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "fill-rule",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "stop-color",
  "stop-opacity",
  "color",
  "display",
]);

export const REJECTED_PROPERTIES: ReadonlySet<string> = new Set([
  "clip-path",
  "mask",
  "filter",
  "marker",
  "marker-start",
  "marker-mid",
  "marker-end",
  "paint-order",
  "vector-effect",
  "mix-blend-mode",
  "isolation",
  "stroke-dashoffset",
  "visibility",
  "transform",
  "requiredFeatures",
  "requiredExtensions",
  "systemLanguage",
  "enable-background",
]);

export const checkPropertyName = (name: string): void => {
  if (REJECTED_PROPERTIES.has(name)) throw reject(SvgFallback.Unsupported);
};

const stripComments = (text: string): string => {
  const parts: string[] = [];
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("/*", index);
    if (open < 0) {
      parts.push(text.slice(index));
      break;
    }
    const close = text.indexOf("*/", open + 2);
    if (close < 0) throw reject(SvgFallback.Malformed);
    parts.push(text.slice(index, open), " ");
    index = close + 2;
  }
  return parts.join("");
};

const withoutImportant = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().endsWith(IMPORTANT)) return trimmed;
  const head = trimmed.slice(0, trimmed.length - IMPORTANT.length).trimEnd();
  return head.endsWith("!") ? head.slice(0, -1).trim() : trimmed;
};

export const parseDeclarations = (text: string): Declaration[] => {
  const result: Declaration[] = [];
  const source = stripComments(text);
  checkSafeValue(source);
  for (const part of source.split(";")) {
    if (part.length > SVG_VECTOR_LIMITS.maxDeclarationChars) throw reject(SvgFallback.ParseLimit);
    if (part.trim() === "") continue;
    const colon = part.indexOf(":");
    if (colon < 0) throw reject(SvgFallback.Malformed);
    const name = part.slice(0, colon).trim().toLowerCase();
    if (!PROPERTY_NAME.test(name)) throw reject(SvgFallback.Malformed);
    checkPropertyName(name);
    result.push([name, withoutImportant(part.slice(colon + 1))]);
  }
  return result;
};

type Rule = { specificity: number; order: number; declarations: Declaration[] };

export type StyleSheet = {
  index: Map<string, Rule[]>;
  order: number;
  rules: number;
  pairs: number;
};

export const emptySheet = (): StyleSheet => ({ index: new Map(), order: 0, rules: 0, pairs: 0 });

const selectorKey = (selector: string): { key: string; specificity: number } => {
  if (selector.startsWith(".")) return { key: selector, specificity: SPECIFICITY_CLASS };
  if (selector.startsWith("#")) return { key: selector, specificity: SPECIFICITY_ID };
  return { key: selector, specificity: SPECIFICITY_TAG };
};

const addRule = (sheet: StyleSheet, selectorText: string, declarations: Declaration[]): void => {
  const selector = selectorText.trim();
  if (!SIMPLE_SELECTOR.test(selector)) throw reject(SvgFallback.Unsupported);
  const { key, specificity } = selectorKey(selector);
  sheet.order += 1;
  sheet.rules += 1;
  sheet.pairs += declarations.length;
  if (sheet.rules > SVG_VECTOR_LIMITS.maxStyleRules) throw reject(SvgFallback.ParseLimit);
  if (sheet.pairs > SVG_VECTOR_LIMITS.maxStyleDeclarations) throw reject(SvgFallback.ParseLimit);
  const rules = sheet.index.get(key) ?? [];
  rules.push({ specificity, order: sheet.order, declarations });
  sheet.index.set(key, rules);
};

export const addStyleSheet = (sheet: StyleSheet, css: string): void => {
  const source = stripComments(css);
  checkSafeValue(source);
  if (source.includes("@")) throw reject(SvgFallback.Unsupported);
  let index = 0;
  while (source.indexOf("{", index) >= 0) {
    const open = source.indexOf("{", index);
    const close = source.indexOf("}", open + 1);
    const body = close < 0 ? "{" : source.slice(open + 1, close);
    if (body.includes("{")) throw reject(SvgFallback.Malformed);
    const declarations = parseDeclarations(body);
    for (const selector of source.slice(index, open).split(",")) {
      addRule(sheet, selector, declarations);
    }
    index = close + 1;
  }
  if (source.slice(index).trim() !== "") throw reject(SvgFallback.Malformed);
};

const rulesFor = (sheet: StyleSheet, element: XmlElement): Rule[] => {
  const keys = [element.name];
  const id = element.attrs.get("id");
  if (id !== undefined) keys.push(`#${id}`);
  const classes = (element.attrs.get("class") ?? "").trim().split(WHITESPACE).filter(Boolean);
  if (classes.length > MAX_CLASS_TOKENS) throw reject(SvgFallback.ParseLimit);
  for (const name of classes) keys.push(`.${name}`);
  const found = keys.flatMap((key) => sheet.index.get(key) ?? []);
  return found.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
};

export const declarationsOf = (
  element: XmlElement,
  sheet: StyleSheet,
  budget: Budget,
): Declaration[] => {
  const result: Declaration[] = [];
  for (const [name, value] of element.attrs) {
    if (name === "transform" || name === "style") continue;
    checkPropertyName(name);
    if (PRESENTATION_PROPERTIES.has(name)) result.push([name, value]);
  }
  for (const rule of rulesFor(sheet, element)) {
    spend(budget, rule.declarations.length);
    result.push(...rule.declarations);
  }
  const inline = element.attrs.get("style");
  if (inline !== undefined) result.push(...parseDeclarations(inline));
  spend(budget, result.length + 1);
  return result;
};

export type Style = {
  fill: SvgPaint;
  stroke: SvgPaint;
  color: string;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  cap: DesignPathCap;
  join: DesignPathJoin;
  miterLimit: number;
  dashed: boolean;
  fillRule: DesignPathFillRule;
};

export const ROOT_STYLE: Style = {
  fill: { kind: SvgPaintKind.Solid, color: BLACK },
  stroke: NO_PAINT,
  color: BLACK,
  fillOpacity: 1,
  strokeOpacity: 1,
  strokeWidth: 1,
  cap: DesignPathCap.Butt,
  join: DesignPathJoin.Miter,
  miterLimit: 4,
  dashed: false,
  fillRule: DesignPathFillRule.NonZero,
};

const CAPS: ReadonlyMap<string, DesignPathCap> = new Map<string, DesignPathCap>(
  Object.entries({
    butt: DesignPathCap.Butt,
    round: DesignPathCap.Round,
    square: DesignPathCap.Square,
  }),
);

const JOINS: ReadonlyMap<string, DesignPathJoin> = new Map<string, DesignPathJoin>(
  Object.entries({
    miter: DesignPathJoin.Miter,
    round: DesignPathJoin.Round,
    bevel: DesignPathJoin.Bevel,
  }),
);

const RULES: ReadonlyMap<string, DesignPathFillRule> = new Map<string, DesignPathFillRule>(
  Object.entries({
    nonzero: DesignPathFillRule.NonZero,
    evenodd: DesignPathFillRule.EvenOdd,
  }),
);

const INHERIT = "inherit";

const choose = <T extends string>(
  value: string,
  choices: ReadonlyMap<string, T>,
  current: T,
): T => {
  if (value.trim().toLowerCase() === INHERIT) return current;
  const found = choices.get(value.trim().toLowerCase());
  if (found === undefined) throw reject(SvgFallback.Unsupported);
  return found;
};

const readDashed = (value: string): boolean => {
  const text = value.trim().toLowerCase();
  if (text === "none") return false;
  return readNumberList(text, MAX_DASH_ITEMS).some((item) => item > 0);
};

const readWidth = (value: string): number => {
  const width = readLength(value);
  if (width < 0) throw reject(SvgFallback.Malformed);
  return width;
};

const applyPaint = (value: string, current: SvgPaint, color: string): SvgPaint =>
  readPaint(value, color) ?? current;

const applyProperty = (style: Style, name: string, value: string): Style => {
  switch (name) {
    case "fill":
      return { ...style, fill: applyPaint(value, style.fill, style.color) };
    case "stroke":
      return { ...style, stroke: applyPaint(value, style.stroke, style.color) };
    case "stroke-width":
      return { ...style, strokeWidth: readWidth(value) };
    case "stroke-linecap":
      return { ...style, cap: choose(value, CAPS, style.cap) };
    case "stroke-linejoin":
      return { ...style, join: choose(value, JOINS, style.join) };
    case "stroke-miterlimit":
      return { ...style, miterLimit: readNumber(value) };
    case "stroke-dasharray":
      return { ...style, dashed: readDashed(value) };
    case "fill-rule":
      return { ...style, fillRule: choose(value, RULES, style.fillRule) };
    case "fill-opacity":
      return { ...style, fillOpacity: readUnit(value) };
    case "stroke-opacity":
      return { ...style, strokeOpacity: readUnit(value) };
    default:
      return style;
  }
};

export type ComputedStyle = { style: Style; opacity: number; hidden: boolean };

export const computeStyle = (
  parent: Style,
  declarations: readonly Declaration[],
): ComputedStyle => {
  const finals = new Map<string, string>();
  for (const [name, value] of declarations) finals.set(name, value);
  const color = finals.get("color");
  let style: Style =
    color === undefined ? parent : { ...parent, color: readSolidColor(color, parent.color) };
  for (const [name, value] of finals) style = applyProperty(style, name, value);
  const opacity = finals.get("opacity");
  return {
    style,
    opacity: opacity === undefined ? 1 : readUnit(opacity),
    hidden: finals.get("display")?.trim().toLowerCase() === "none",
  };
};

export type StopStyle = { color: string; opacity: number };

export const stopStyleOf = (declarations: readonly Declaration[]): StopStyle => {
  const finals = new Map<string, string>(declarations);
  const color = finals.get("stop-color");
  const opacity = finals.get("stop-opacity");
  return {
    color: color === undefined ? BLACK : readSolidColor(color, BLACK),
    opacity: opacity === undefined ? 1 : readUnit(opacity),
  };
};
