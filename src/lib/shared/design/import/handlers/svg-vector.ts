import { SVG_VECTOR_LIMITS } from "@/lib/shared/design/import/limits";
import { sanitizeImportName } from "@/lib/shared/design/import/sanitize";
import {
  type GradientContext,
  gradientPaint,
  singleStopColor,
} from "@/lib/shared/design/import/handlers/svg-gradient";
import {
  SHAPE_NAMES,
  SVG_PATH_LIMITS,
  shapeCommands,
} from "@/lib/shared/design/import/handlers/svg-shapes";
import {
  type ComputedStyle,
  type Style,
  PRESENTATION_PROPERTIES,
  ROOT_STYLE,
  addStyleSheet,
  checkPropertyName,
  computeStyle,
  declarationsOf,
  emptySheet,
  parseDeclarations,
} from "@/lib/shared/design/import/handlers/svg-style";
import {
  type Budget,
  type Deadline,
  type SvgVectorOptions,
  type SvgVectorResult,
  type SvgVectorShape,
  type XmlElement,
  SvgFallback,
  SvgReject,
  checkDeadline,
  reject,
  spend,
  startBudget,
  startDeadline,
  svgFailure,
} from "@/lib/shared/design/import/handlers/svg-vector-types";
import {
  SvgPaintKind,
  checkSafeValue,
  readLengthOrPercent,
  readNumberList,
  readTransform,
  readLength,
} from "@/lib/shared/design/import/handlers/svg-values";
import { decodeSvgBytes, tokenizeSvg } from "@/lib/shared/design/import/handlers/svg-xml";
import type { PathPaint, PathStroke } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignPathPaintKind } from "@/lib/shared/design/types";
import {
  type Matrix,
  IDENTITY,
  compose,
  determinant,
  scale,
  translate,
} from "@/lib/shared/design/vector/matrix";
import {
  pathBounds,
  quantizeCommands,
  serializePath,
  transformPath,
} from "@/lib/shared/design/vector/path-data";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const FRAGMENT = /^#[\w.:-]+$/;
const ROOT_NAME = "svg";
const INERT_ELEMENTS: ReadonlySet<string> = new Set(["title", "desc", "metadata"]);
const GRADIENT_ELEMENTS: ReadonlySet<string> = new Set(["linearGradient", "radialGradient"]);
const CONTAINER_ELEMENTS: ReadonlySet<string> = new Set(["g", "use"]);
const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
  ROOT_NAME,
  "g",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "use",
  "style",
  ...SHAPE_NAMES,
]);
const ENDS_WITHOUT_CHILDREN: ReadonlySet<string> = new Set([
  "defs",
  "stop",
  "style",
  ...GRADIENT_ELEMENTS,
  ...INERT_ELEMENTS,
]);
const ASPECT_TOLERANCE = 1e-3;
const DECIMALS = 1000;
const STYLE_TYPE = "text/css";
const STYLE_COST_SHIFT = 6;
const UNASSIGNED = /\p{Cn}/gu;

const round = (value: number): number => Math.round(value * DECIMALS) / DECIMALS;

type Prepared = {
  budget: Budget;
  root: XmlElement;
  ids: Map<string, XmlElement>;
  sheet: ReturnType<typeof emptySheet>;
};

const checkAttribute = (
  element: XmlElement,
  name: string,
  value: string,
  prepared: Prepared,
): void => {
  if (name.toLowerCase().startsWith("on")) throw reject(SvgFallback.Unsupported);
  const isHref = name === "href" || name === "xlink:href";
  const hrefAllowed = element.name === "use" || GRADIENT_ELEMENTS.has(element.name);
  if (isHref && !(hrefAllowed && FRAGMENT.test(value))) throw reject(SvgFallback.Unsupported);
  if (isHref) return;
  if (name === "xmlns" && value !== SVG_NAMESPACE) throw reject(SvgFallback.Unsupported);
  if (name === "style") {
    spend(prepared.budget, 1 + (value.length >> STYLE_COST_SHIFT));
    parseDeclarations(value);
    return;
  }
  if (name === "transform") return;
  checkPropertyName(name);
  if (PRESENTATION_PROPERTIES.has(name)) checkSafeValue(value);
};

const checkElement = (element: XmlElement, isRoot: boolean, prepared: Prepared): void => {
  const inert = INERT_ELEMENTS.has(element.name);
  if (!inert && !ALLOWED_ELEMENTS.has(element.name)) throw reject(SvgFallback.Unsupported);
  if (element.name === ROOT_NAME && !isRoot) throw reject(SvgFallback.Unsupported);
  for (const [name, value] of element.attrs) checkAttribute(element, name, value, prepared);
  const id = element.attrs.get("id");
  if (id !== undefined && prepared.ids.has(id)) throw reject(SvgFallback.Malformed);
  if (id !== undefined) prepared.ids.set(id, element);
  if (element.name !== "style") return;
  const type = element.attrs.get("type");
  if (type !== undefined && type !== STYLE_TYPE) throw reject(SvgFallback.Unsupported);
  addStyleSheet(prepared.sheet, element.text);
};

const prepare = (root: XmlElement, budget: Budget): Prepared => {
  const deadline = budget.deadline;
  if (root.name !== ROOT_NAME) throw reject(SvgFallback.Unsupported);
  const prepared: Prepared = { budget, root, ids: new Map(), sheet: emptySheet() };
  const stack: XmlElement[] = [root];
  while (stack.length > 0) {
    const element = stack.pop();
    if (element === undefined) break;
    checkDeadline(deadline);
    checkElement(element, element === root, prepared);
    if (INERT_ELEMENTS.has(element.name)) continue;
    stack.push(...element.children);
  }
  return prepared;
};

const targetOf = (element: XmlElement, ids: ReadonlyMap<string, XmlElement>): XmlElement => {
  const href = element.attrs.get("href") ?? element.attrs.get("xlink:href");
  const target = href === undefined ? undefined : ids.get(href.slice(1));
  const renderable =
    target !== undefined && (CONTAINER_ELEMENTS.has(target.name) || SHAPE_NAMES.has(target.name));
  if (target === undefined || !renderable) throw reject(SvgFallback.Unsupported);
  return target;
};

const edgesOf = (element: XmlElement, ids: ReadonlyMap<string, XmlElement>): XmlElement[] => {
  if (ENDS_WITHOUT_CHILDREN.has(element.name)) return [];
  if (element.name === "use") return [targetOf(element, ids)];
  return element.children;
};

type Cost = { nodes: number; uses: number };

type Visit = { element: XmlElement; edges: XmlElement[]; next: number };

const costOf = (element: XmlElement, edges: readonly XmlElement[], done: Map<XmlElement, Cost>) => {
  const cost: Cost = { nodes: 1, uses: element.name === "use" ? 1 : 0 };
  for (const edge of edges) {
    cost.nodes += done.get(edge)?.nodes ?? 0;
    cost.uses += done.get(edge)?.uses ?? 0;
  }
  if (cost.nodes > SVG_VECTOR_LIMITS.maxNodes) throw reject(SvgFallback.ParseLimit);
  if (cost.uses > SVG_VECTOR_LIMITS.maxUseExpansions) throw reject(SvgFallback.ParseLimit);
  return cost;
};

const measure = (prepared: Prepared, deadline: Deadline): void => {
  const { root, ids } = prepared;
  const done = new Map<XmlElement, Cost>();
  const active = new Set<XmlElement>([root]);
  const stack: Visit[] = [{ element: root, edges: edgesOf(root, ids), next: 0 }];
  while (stack.length > 0) {
    checkDeadline(deadline);
    const top = stack[stack.length - 1];
    if (top === undefined) break;
    const edge = top.edges[top.next];
    if (edge === undefined) {
      done.set(top.element, costOf(top.element, top.edges, done));
      active.delete(top.element);
      stack.pop();
      continue;
    }
    top.next += 1;
    if (active.has(edge)) throw reject(SvgFallback.Malformed);
    if (done.has(edge)) continue;
    active.add(edge);
    stack.push({ element: edge, edges: edgesOf(edge, ids), next: 0 });
  }
};

type Page = {
  width: number;
  height: number;
  viewWidth: number;
  viewHeight: number;
  matrix: Matrix;
};

const readSide = (text: string | undefined): number | null => {
  if (text === undefined) return null;
  const length = readLengthOrPercent(text);
  return length.percent ? null : length.value;
};

const readPage = (root: XmlElement): Page => {
  const box = root.attrs.get("viewBox");
  const view = box === undefined ? null : readNumberList(box, 4);
  if (view !== null && view.length !== 4) throw reject(SvgFallback.Malformed);
  const [minX = 0, minY = 0, viewWidth = 0, viewHeight = 0] = view ?? [];
  const width = readSide(root.attrs.get("width")) ?? (view === null ? null : viewWidth);
  const height = readSide(root.attrs.get("height")) ?? (view === null ? null : viewHeight);
  if (width === null || height === null) throw reject(SvgFallback.Unsupported);
  if (width <= 0 || height <= 0) throw reject(SvgFallback.Malformed);
  if (width > DESIGN_LIMITS.maxSize || height > DESIGN_LIMITS.maxSize) {
    throw reject(SvgFallback.TooLarge);
  }
  if (view === null) {
    return { width, height, viewWidth: width, viewHeight: height, matrix: IDENTITY };
  }
  if (viewWidth <= 0 || viewHeight <= 0) throw reject(SvgFallback.Malformed);
  const sx = width / viewWidth;
  const sy = height / viewHeight;
  if (Math.abs(sx / sy - 1) > ASPECT_TOLERANCE) throw reject(SvgFallback.Unsupported);
  return {
    width: round(width),
    height: round(height),
    viewWidth,
    viewHeight,
    matrix: compose(scale(sx, sy), translate(-minX, -minY)),
  };
};

type Frame = {
  element: XmlElement;
  ctm: Matrix;
  style: Style;
  opacity: number;
  name: string | null;
};

type Run = {
  prepared: Prepared;
  gradients: GradientContext;
  shapes: SvgVectorShape[];
  dataBytes: number;
};

const nameOf = (element: XmlElement, inherited: string | null): string | null => {
  const id = element.attrs.get("id");
  if (id === undefined) return inherited;
  const clean = sanitizeImportName(id.replace(UNASSIGNED, "")).trim();
  return clean === "" ? inherited : clean;
};

const resolveFill = (run: Run, style: Style, target: Parameters<typeof gradientPaint>[2]) => {
  const { fill } = style;
  if (fill.kind === SvgPaintKind.None) return null;
  if (fill.kind === SvgPaintKind.Solid) {
    return { kind: DesignPathPaintKind.Solid, color: fill.color } satisfies PathPaint;
  }
  const single = singleStopColor(run.gradients, fill.id);
  if (single !== null)
    return { kind: DesignPathPaintKind.Solid, color: single } satisfies PathPaint;
  return gradientPaint(run.gradients, fill.id, target);
};

const resolveStroke = (style: Style, ctm: Matrix): PathStroke | null => {
  const { stroke } = style;
  if (stroke.kind === SvgPaintKind.None) return null;
  if (stroke.kind === SvgPaintKind.Reference) throw reject(SvgFallback.Unsupported);
  const width = style.strokeWidth * Math.sqrt(Math.abs(determinant(ctm)));
  if (!(width > 0)) return null;
  if (width > DESIGN_LIMITS.maxPathStrokeWidth) throw reject(SvgFallback.TooLarge);
  return {
    color: stroke.color,
    width: round(Math.max(width, DESIGN_LIMITS.minPathStrokeWidth)),
    cap: style.cap,
    join: style.join,
    miterLimit: Math.min(
      DESIGN_LIMITS.maxMiterLimit,
      Math.max(DESIGN_LIMITS.minMiterLimit, style.miterLimit),
    ),
    dashed: style.dashed,
  };
};

const emitShape = (run: Run, frame: Frame, computed: ComputedStyle): void => {
  const { element, ctm } = frame;
  const commands = shapeCommands(element);
  if (commands === null) return;
  const local = pathBounds(commands);
  const moved = transformPath(commands, ctm, SVG_PATH_LIMITS);
  if (!local.ok || !moved.ok) throw reject(SvgFallback.TooLarge);
  const quantized = quantizeCommands(moved.commands);
  const page = pathBounds(quantized);
  if (!page.ok) return;
  const { minX, minY, maxX, maxY } = page.bounds;
  if (maxX - minX > DESIGN_LIMITS.maxSize || maxY - minY > DESIGN_LIMITS.maxSize) {
    throw reject(SvgFallback.TooLarge);
  }
  const written = serializePath(quantized, SVG_PATH_LIMITS);
  if (!written.ok) throw reject(SvgFallback.VectorLimit);
  const { style } = computed;
  const isLine = element.name === "line";
  const fill = isLine
    ? null
    : resolveFill(run, style, { ctm, localBounds: local.bounds, pageBounds: page.bounds });
  const stroke = resolveStroke(style, ctm);
  if (fill === null && stroke === null) return;
  if (fill !== null && stroke !== null && style.fillOpacity !== style.strokeOpacity) {
    throw reject(SvgFallback.Unsupported);
  }
  const alpha = fill === null ? style.strokeOpacity : style.fillOpacity;
  const opacity = round(frame.opacity * alpha);
  if (opacity <= 0) return;
  run.dataBytes += written.d.length;
  if (run.dataBytes > DESIGN_LIMITS.maxVectorImportBytes) throw reject(SvgFallback.VectorLimit);
  run.shapes.push({
    name: frame.name,
    d: written.d,
    commandCount: quantized.length,
    fill,
    stroke,
    fillRule: style.fillRule,
    opacity,
    bounds: page.bounds,
  });
  if (run.shapes.length > DESIGN_LIMITS.maxElements) throw reject(SvgFallback.VectorLimit);
};

const childFrames = (run: Run, frame: Frame, computed: ComputedStyle): Frame[] => {
  const { element } = frame;
  const base = {
    style: computed.style,
    opacity: frame.opacity * computed.opacity,
    name: nameOf(element, frame.name),
  };
  if (element.name === "use") {
    const x = readLength(element.attrs.get("x") ?? "0");
    const y = readLength(element.attrs.get("y") ?? "0");
    const target = targetOf(element, run.prepared.ids);
    return [{ ...base, element: target, ctm: compose(frame.ctm, translate(x, y)) }];
  }
  return element.children.map((child) => ({ ...base, element: child, ctm: frame.ctm }));
};

const render = (run: Run, page: Page, deadline: Deadline): void => {
  const { root } = run.prepared;
  const stack: Frame[] = [
    { element: root, ctm: page.matrix, style: ROOT_STYLE, opacity: 1, name: null },
  ];
  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    checkDeadline(deadline);
    const { element } = frame;
    if (ENDS_WITHOUT_CHILDREN.has(element.name)) continue;
    const computed = computeStyle(
      frame.style,
      declarationsOf(element, run.prepared.sheet, run.prepared.budget),
    );
    if (computed.hidden) continue;
    const transform = element.attrs.get("transform");
    const here: Frame = {
      ...frame,
      ctm: transform === undefined ? frame.ctm : compose(frame.ctm, readTransform(transform)),
      name: nameOf(element, frame.name),
    };
    if (SHAPE_NAMES.has(element.name)) {
      emitShape(run, { ...here, opacity: here.opacity * computed.opacity }, computed);
      continue;
    }
    stack.push(...childFrames(run, here, computed).reverse());
  }
};

const parseText = (text: string, deadline: Deadline): SvgVectorResult => {
  const prepared = prepare(tokenizeSvg(text, deadline), startBudget(deadline));
  measure(prepared, deadline);
  const page = readPage(prepared.root);
  const run: Run = {
    prepared,
    gradients: {
      ids: prepared.ids,
      sheet: prepared.sheet,
      cache: new Map(),
      budget: prepared.budget,
      viewportWidth: page.viewWidth,
      viewportHeight: page.viewHeight,
    },
    shapes: [],
    dataBytes: 0,
  };
  render(run, page, deadline);
  if (run.shapes.length === 0) throw reject(SvgFallback.Unsupported);
  return {
    ok: true,
    width: page.width,
    height: page.height,
    shapes: run.shapes,
    dataBytes: run.dataBytes,
  };
};

export const parseSvgVector = (
  input: Uint8Array | string,
  options: SvgVectorOptions = {},
): SvgVectorResult => {
  try {
    const deadline = startDeadline(options);
    const text = typeof input === "string" ? input : decodeSvgBytes(input);
    return parseText(text, deadline);
  } catch (error) {
    return svgFailure(error instanceof SvgReject ? error.reason : SvgFallback.Internal);
  }
};
