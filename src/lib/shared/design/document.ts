import { pageSizeOf } from "@/lib/shared/design/crop";
import { databaseDocumentBytes } from "@/lib/shared/design/document-size";
import { scalePathStroke } from "@/lib/shared/design/path-scale";
import type {
  DesignDocument,
  DesignElement,
  DesignPage,
  ImageElement,
  LineElement,
  RasterElement,
  RectElement,
  TextElement,
} from "@/lib/shared/design/schemas";
import {
  DESIGN_FONT_LABEL,
  DESIGN_LIMITS,
  DESIGN_PRESET_SIZE,
  DesignElementKind,
  DesignBlendMode,
  DesignFont,
  type DesignPreset,
  DesignTextAlign,
  LayerMove,
  type PageSize,
} from "@/lib/shared/design/types";

export type DesignPalette = { ink: string; surface: string; accent: string };

export type ElementBasePatch = Partial<
  Pick<
    DesignElement,
    | "x"
    | "y"
    | "width"
    | "height"
    | "rotation"
    | "opacity"
    | "locked"
    | "blendMode"
    | "fillOpacity"
    | "name"
    | "hidden"
    | "clipToBelow"
    | "mask"
  >
>;
export type TextPatch = Partial<
  Pick<
    TextElement,
    "text" | "font" | "fontSize" | "bold" | "italic" | "color" | "align" | "lineHeight" | "shadow"
  >
>;
export type ImagePatch = Partial<
  Pick<
    ImageElement,
    "flipX" | "flipY" | "zoom" | "focusX" | "focusY" | "brightness" | "contrast" | "alt"
  >
>;
export type ShapePatch = Partial<Pick<RectElement, "fill" | "cornerRadius">>;
export type LinePatch = Partial<Pick<LineElement, "stroke" | "strokeWidth" | "dashed">>;
export type ElementPatch = { id: string; patch: ElementBasePatch };

export const inRange = (value: number | null, min: number, max: number): value is number =>
  value !== null && value >= min && value <= max;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const channel = (value: number): string =>
  Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, "0");

export const rgbToHex = (red: number, green: number, blue: number): string =>
  `#${channel(red)}${channel(green)}${channel(blue)}`;

export const normalizeColor = (value: string): string | null => {
  const text = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short !== null) {
    const [, r = "0", g = "0", b = "0"] = short;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(text);
  if (rgb === null) return null;
  const [, r = "0", g = "0", b = "0"] = rgb;
  return rgbToHex(Number(r), Number(g), Number(b));
};

export const isRendered = (element: DesignElement): boolean => !element.hidden;

export const canvasBlendOperation = (mode: DesignBlendMode): GlobalCompositeOperation =>
  mode === DesignBlendMode.Normal ? "source-over" : mode;

export const emptyPage = (id: string): DesignPage => ({ id, background: null, elements: [] });

export const emptyDocument = (pageId = "page-1"): DesignDocument => ({
  version: 4,
  pages: [emptyPage(pageId)],
});

const placed = (preset: DesignPreset, width: number, height: number) => {
  const page = DESIGN_PRESET_SIZE[preset];
  return {
    x: Math.round((page.width - width) / 2),
    y: Math.round((page.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    groupId: null,
    blendMode: DesignBlendMode.Normal,
    fillOpacity: 1,
    name: "",
    hidden: false,
    parentId: null,
    clipToBelow: false,
    mask: null,
  };
};

export const newLayerName = (page: DesignPage): string => {
  const names = new Set(page.elements.map((element) => element.name));
  let number = page.elements.filter((element) => element.kind === DesignElementKind.Raster).length;
  do {
    number += 1;
  } while (names.has(`Camada ${number}`));
  return `Camada ${number}`;
};

export const createRasterLayer = (id: string, page: DesignPage, size: PageSize): RasterElement => ({
  id,
  kind: DesignElementKind.Raster,
  x: 0,
  y: 0,
  width: size.width,
  height: size.height,
  rotation: 0,
  opacity: 1,
  locked: false,
  groupId: null,
  blendMode: DesignBlendMode.Normal,
  fillOpacity: 1,
  name: newLayerName(page),
  hidden: false,
  parentId: null,
  clipToBelow: false,
  mask: null,
  pixelsVersionId: null,
  pixelWidth: Math.min(size.width, DESIGN_LIMITS.maxRasterSide),
  pixelHeight: Math.min(size.height, DESIGN_LIMITS.maxRasterSide),
});

export type InheritedLayer = { element: DesignElement; hidden: boolean; opacity: number };

export const resolveInheritance = (page: DesignPage): InheritedLayer[] => {
  const byId = new Map(page.elements.map((element) => [element.id, element]));
  return page.elements.map((element) => {
    let hidden = element.hidden;
    let opacity = element.opacity;
    let parent = element.parentId === null ? undefined : byId.get(element.parentId);
    let depth = 0;
    while (parent !== undefined && depth < DESIGN_LIMITS.maxGroupDepth) {
      hidden = hidden || parent.hidden;
      opacity *= parent.opacity;
      parent = parent.parentId === null ? undefined : byId.get(parent.parentId);
      depth += 1;
    }
    return { element, hidden, opacity };
  });
};

export const isRasterStackKind = (element: DesignElement): boolean =>
  element.kind === DesignElementKind.Raster || element.kind === DesignElementKind.Adjustment;

export const hasAdjustments = (page: DesignPage): boolean =>
  page.elements.some((element) => element.kind === DesignElementKind.Adjustment && !element.hidden);

export const rasterPixelsIds = (document: DesignDocument): string[] => [
  ...new Set(
    document.pages.flatMap((page) =>
      page.elements.flatMap((element) => {
        const ids: string[] = [];
        if (element.kind === DesignElementKind.Raster && element.pixelsVersionId !== null) {
          ids.push(element.pixelsVersionId);
        }
        if (element.mask?.mediaVersionId) ids.push(element.mask.mediaVersionId);
        return ids;
      }),
    ),
  ),
];

export const createText = (
  id: string,
  preset: DesignPreset,
  palette: DesignPalette,
): TextElement => ({
  id,
  kind: DesignElementKind.Text,
  ...placed(preset, Math.round(DESIGN_PRESET_SIZE[preset].width * 0.7), 160),
  text: "Seu texto aqui",
  font: DesignFont.DmSans,
  fontSize: 72,
  bold: true,
  italic: false,
  color: palette.ink,
  align: DesignTextAlign.Center,
  lineHeight: 1.2,
  shadow: null,
});

export const createShape = (
  id: string,
  kind: typeof DesignElementKind.Rect | typeof DesignElementKind.Ellipse,
  preset: DesignPreset,
  palette: DesignPalette,
): DesignElement => {
  const side = Math.round(DESIGN_PRESET_SIZE[preset].width * 0.4);
  const base = placed(preset, side, side);
  return kind === DesignElementKind.Rect
    ? { id, kind, ...base, fill: palette.accent, cornerRadius: 0 }
    : { id, kind, ...base, fill: palette.accent };
};

export const createLine = (
  id: string,
  preset: DesignPreset,
  palette: DesignPalette,
): LineElement => ({
  id,
  kind: DesignElementKind.Line,
  ...placed(preset, Math.round(DESIGN_PRESET_SIZE[preset].width * 0.6), 24),
  stroke: palette.ink,
  strokeWidth: 6,
  dashed: false,
});

export const fitInside = (natural: PageSize, page: PageSize): PageSize => {
  const ratio = Math.min(
    1,
    (page.width * 0.8) / natural.width,
    (page.height * 0.8) / natural.height,
  );
  return {
    width: Math.max(DESIGN_LIMITS.minSize, Math.round(natural.width * ratio)),
    height: Math.max(DESIGN_LIMITS.minSize, Math.round(natural.height * ratio)),
  };
};

export const createImage = (
  id: string,
  preset: DesignPreset,
  mediaVersionId: string,
  natural: PageSize | null,
): ImageElement => {
  const page = DESIGN_PRESET_SIZE[preset];
  const box = fitInside(natural ?? { width: page.width / 2, height: page.width / 2 }, page);
  return {
    id,
    kind: DesignElementKind.Image,
    ...placed(preset, box.width, box.height),
    mediaVersionId,
    flipX: false,
    flipY: false,
    zoom: 1,
    focusX: 0.5,
    focusY: 0.5,
    brightness: 0,
    contrast: 0,
    alt: "",
  };
};

export const coverCrop = (
  natural: PageSize,
  frame: PageSize,
  zoom: number,
  focusX: number,
  focusY: number,
) => {
  const frameRatio = frame.width / frame.height;
  const wide = natural.width / natural.height > frameRatio;
  const baseWidth = wide ? natural.height * frameRatio : natural.width;
  const baseHeight = wide ? natural.height : natural.width / frameRatio;
  const width = baseWidth / zoom;
  const height = baseHeight / zoom;
  return {
    x: (natural.width - width) * clamp(focusX, 0, 1),
    y: (natural.height - height) * clamp(focusY, 0, 1),
    width,
    height,
  };
};

export const mapElements = (
  page: DesignPage,
  ids: readonly string[],
  update: (element: DesignElement) => DesignElement,
): DesignPage => ({
  ...page,
  elements: page.elements.map((element) => (ids.includes(element.id) ? update(element) : element)),
});

export const normalizeRotation = (degrees: number): number =>
  Math.round((degrees % 360) * 100) / 100;

const sanitizeBase = (patch: ElementBasePatch): ElementBasePatch => {
  const coordinate = (value: number) =>
    clamp(value, -DESIGN_LIMITS.maxCoordinate, DESIGN_LIMITS.maxCoordinate);
  const size = (value: number) => clamp(value, DESIGN_LIMITS.minSize, DESIGN_LIMITS.maxSize);
  return {
    ...patch,
    ...(patch.x === undefined ? {} : { x: coordinate(patch.x) }),
    ...(patch.y === undefined ? {} : { y: coordinate(patch.y) }),
    ...(patch.width === undefined ? {} : { width: size(patch.width) }),
    ...(patch.height === undefined ? {} : { height: size(patch.height) }),
    ...(patch.rotation === undefined ? {} : { rotation: normalizeRotation(patch.rotation) }),
    ...(patch.opacity === undefined ? {} : { opacity: clamp(patch.opacity, 0, 1) }),
    ...(patch.fillOpacity === undefined ? {} : { fillOpacity: clamp(patch.fillOpacity, 0, 1) }),
    ...(patch.name === undefined ? {} : { name: patch.name.slice(0, DESIGN_LIMITS.layerNameMax) }),
  };
};

export const patchElements = (page: DesignPage, patches: readonly ElementPatch[]): DesignPage => {
  const byId = new Map(patches.map((item) => [item.id, sanitizeBase(item.patch)]));
  return {
    ...page,
    elements: page.elements.map((element) => {
      const patch = byId.get(element.id);
      return patch === undefined ? element : { ...element, ...patch };
    }),
  };
};

export const patchElement = (page: DesignPage, id: string, patch: ElementBasePatch): DesignPage =>
  patchElements(page, [{ id, patch }]);

export const patchText = (page: DesignPage, id: string, patch: TextPatch): DesignPage => {
  const clean: TextPatch = {
    ...patch,
    ...(patch.text === undefined ? {} : { text: patch.text.slice(0, DESIGN_LIMITS.maxText) }),
    ...(patch.fontSize === undefined
      ? {}
      : {
          fontSize: clamp(patch.fontSize, DESIGN_LIMITS.minFontSize, DESIGN_LIMITS.maxFontSize),
        }),
    ...(patch.lineHeight === undefined
      ? {}
      : {
          lineHeight: clamp(
            patch.lineHeight,
            DESIGN_LIMITS.minLineHeight,
            DESIGN_LIMITS.maxLineHeight,
          ),
        }),
  };
  return mapElements(page, [id], (element) =>
    element.kind === DesignElementKind.Text ? { ...element, ...clean } : element,
  );
};

export const patchImage = (page: DesignPage, id: string, patch: ImagePatch): DesignPage => {
  const clean: ImagePatch = {
    ...patch,
    ...(patch.zoom === undefined
      ? {}
      : { zoom: clamp(patch.zoom, DESIGN_LIMITS.minZoom, DESIGN_LIMITS.maxZoom) }),
    ...(patch.focusX === undefined ? {} : { focusX: clamp(patch.focusX, 0, 1) }),
    ...(patch.focusY === undefined ? {} : { focusY: clamp(patch.focusY, 0, 1) }),
    ...(patch.alt === undefined ? {} : { alt: patch.alt.slice(0, DESIGN_LIMITS.maxAlt) }),
  };
  return mapElements(page, [id], (element) =>
    element.kind === DesignElementKind.Image ? { ...element, ...clean } : element,
  );
};

export const patchShape = (page: DesignPage, id: string, patch: ShapePatch): DesignPage =>
  mapElements(page, [id], (element) => {
    if (element.kind === DesignElementKind.Rect) {
      return {
        ...element,
        ...patch,
        ...(patch.cornerRadius === undefined
          ? {}
          : { cornerRadius: clamp(patch.cornerRadius, 0, DESIGN_LIMITS.maxCornerRadius) }),
      };
    }
    if (element.kind !== DesignElementKind.Ellipse || patch.fill === undefined) return element;
    return { ...element, fill: patch.fill };
  });

export const patchLine = (page: DesignPage, id: string, patch: LinePatch): DesignPage =>
  mapElements(page, [id], (element) => {
    if (element.kind !== DesignElementKind.Line) return element;
    const strokeWidth =
      patch.strokeWidth === undefined
        ? element.strokeWidth
        : clamp(patch.strokeWidth, DESIGN_LIMITS.minStroke, DESIGN_LIMITS.maxStroke);
    return { ...element, ...patch, strokeWidth };
  });

export const setBackground = (page: DesignPage, background: string | null): DesignPage => ({
  ...page,
  background,
});

export const elementCount = (document: DesignDocument): number =>
  document.pages.reduce((total, page) => total + page.elements.length, 0);

export const canAddElements = (document: DesignDocument, count = 1): boolean =>
  elementCount(document) + count <= DESIGN_LIMITS.maxElements;

export const addElement = (page: DesignPage, element: DesignElement): DesignPage => ({
  ...page,
  elements: [...page.elements, element],
});

export const addImportedLayers = (
  page: DesignPage,
  elements: readonly DesignElement[],
  size: PageSize | null,
): DesignPage => ({
  ...page,
  ...(size === null ? {} : { width: size.width, height: size.height }),
  elements: [...page.elements, ...elements],
});

export const removeElements = (page: DesignPage, ids: readonly string[]): DesignPage => {
  const parents = new Map(page.elements.map((element) => [element.id, element.parentId]));
  const surviving = (parentId: string | null): string | null => {
    let current = parentId;
    while (current !== null && ids.includes(current)) current = parents.get(current) ?? null;
    return current;
  };
  return {
    ...page,
    elements: page.elements
      .filter((element) => !ids.includes(element.id))
      .map((element) =>
        element.parentId === null || !ids.includes(element.parentId)
          ? element
          : { ...element, parentId: surviving(element.parentId) },
      ),
  };
};

export const duplicateElements = (
  page: DesignPage,
  ids: readonly string[],
  newId: () => string,
): { page: DesignPage; ids: string[] } => {
  const groups = new Map<string, string>();
  const copyIds: string[] = [];
  const offset = (value: number) =>
    clamp(
      value + DESIGN_LIMITS.duplicateOffset,
      -DESIGN_LIMITS.maxCoordinate,
      DESIGN_LIMITS.maxCoordinate,
    );
  const groupOf = (groupId: string | null) => {
    if (groupId === null) return null;
    const known = groups.get(groupId) ?? newId();
    groups.set(groupId, known);
    return known;
  };
  const copies = page.elements
    .filter((element) => ids.includes(element.id))
    .map((source) => {
      const id = newId();
      copyIds.push(id);
      return {
        ...source,
        id,
        locked: false,
        x: offset(source.x),
        y: offset(source.y),
        groupId: groupOf(source.groupId),
      };
    });
  return { page: { ...page, elements: [...page.elements, ...copies] }, ids: copyIds };
};

const targetIndex = (move: LayerMove, index: number, last: number): number => {
  if (move === LayerMove.Top) return last;
  if (move === LayerMove.Bottom) return 0;
  if (move === LayerMove.Up) return Math.min(last, index + 1);
  return Math.max(0, index - 1);
};

export const moveLayer = (page: DesignPage, id: string, move: LayerMove): DesignPage => {
  const index = page.elements.findIndex((element) => element.id === id);
  const element = page.elements[index];
  if (element === undefined) return page;
  const target = targetIndex(move, index, page.elements.length - 1);
  if (target === index) return page;
  const elements = page.elements.filter((item) => item.id !== id);
  elements.splice(target, 0, element);
  return { ...page, elements };
};

export const groupElements = (page: DesignPage, ids: readonly string[], groupId: string) =>
  ids.length < 2 ? page : mapElements(page, ids, (element) => ({ ...element, groupId }));

export const ungroupElements = (page: DesignPage, ids: readonly string[]) =>
  mapElements(page, ids, (element) => ({ ...element, groupId: null }));

export const expandSelection = (page: DesignPage, ids: readonly string[]): string[] => {
  const groups = new Set(
    page.elements.flatMap((element) =>
      ids.includes(element.id) && element.groupId !== null ? [element.groupId] : [],
    ),
  );
  return page.elements
    .filter(
      (element) =>
        ids.includes(element.id) || (element.groupId !== null && groups.has(element.groupId)),
    )
    .map((element) => element.id);
};

export const findPage = (document: DesignDocument, pageId: string): DesignPage | undefined =>
  document.pages.find((page) => page.id === pageId);

export const updatePage = (
  document: DesignDocument,
  pageId: string,
  update: (page: DesignPage) => DesignPage,
): DesignDocument => ({
  ...document,
  pages: document.pages.map((page) => (page.id === pageId ? update(page) : page)),
});

export const canAddPage = (document: DesignDocument): boolean =>
  document.pages.length < DESIGN_LIMITS.maxPages;

export const addPage = (
  document: DesignDocument,
  afterId: string,
  page: DesignPage,
): DesignDocument => {
  if (!canAddPage(document)) return document;
  const index = document.pages.findIndex((item) => item.id === afterId);
  const pages = [...document.pages];
  pages.splice(index + 1, 0, page);
  return { ...document, pages };
};

export const duplicatePage = (
  document: DesignDocument,
  pageId: string,
  newPageId: string,
  newId: () => string,
): DesignDocument => {
  const source = findPage(document, pageId);
  if (source === undefined || !canAddElements(document, source.elements.length)) return document;
  const groups = new Map<string, string>();
  const groupOf = (groupId: string | null) => {
    if (groupId === null) return null;
    const known = groups.get(groupId) ?? newId();
    groups.set(groupId, known);
    return known;
  };
  const copy: DesignPage = {
    id: newPageId,
    background: source.background,
    elements: source.elements.map((element) => ({
      ...element,
      id: newId(),
      groupId: groupOf(element.groupId),
    })),
  };
  return addPage(document, pageId, copy);
};

export const removePage = (document: DesignDocument, pageId: string): DesignDocument =>
  document.pages.length <= 1
    ? document
    : { ...document, pages: document.pages.filter((page) => page.id !== pageId) };

export const movePage = (
  document: DesignDocument,
  pageId: string,
  delta: -1 | 1,
): DesignDocument => {
  const index = document.pages.findIndex((page) => page.id === pageId);
  const target = index + delta;
  const page = document.pages[index];
  if (page === undefined || target < 0 || target >= document.pages.length) return document;
  const pages = document.pages.filter((item) => item.id !== pageId);
  pages.splice(target, 0, page);
  return { ...document, pages };
};

export const documentBytes = (document: DesignDocument): number =>
  new TextEncoder().encode(JSON.stringify(document)).length;

export const isTooLarge = (document: DesignDocument): boolean =>
  databaseDocumentBytes(document) > DESIGN_LIMITS.maxBytes;

export const pageImageIds = (page: DesignPage): string[] => [
  ...new Set(
    page.elements.flatMap((element) =>
      element.kind === DesignElementKind.Image ? [element.mediaVersionId] : [],
    ),
  ),
];

export const imageVersionIds = (document: DesignDocument): string[] => [
  ...new Set(document.pages.flatMap(pageImageIds)),
];

const scaleElement = (
  element: DesignElement,
  scale: number,
  offset: { x: number; y: number },
): DesignElement => {
  const base = {
    ...element,
    x: Math.round(element.x * scale + offset.x),
    y: Math.round(element.y * scale + offset.y),
    width: Math.max(DESIGN_LIMITS.minSize, Math.round(element.width * scale)),
    height: Math.max(DESIGN_LIMITS.minSize, Math.round(element.height * scale)),
  };
  if (base.kind === DesignElementKind.Text) {
    return {
      ...base,
      fontSize: clamp(
        Math.round(base.fontSize * scale),
        DESIGN_LIMITS.minFontSize,
        DESIGN_LIMITS.maxFontSize,
      ),
      shadow:
        base.shadow === null
          ? null
          : {
              ...base.shadow,
              blur: Math.round(base.shadow.blur * scale),
              offsetX: Math.round(base.shadow.offsetX * scale),
              offsetY: Math.round(base.shadow.offsetY * scale),
            },
    };
  }
  if (base.kind === DesignElementKind.Rect) {
    return { ...base, cornerRadius: Math.round(base.cornerRadius * scale) };
  }
  if (base.kind === DesignElementKind.Path) return scalePathStroke(base, scale);
  if (base.kind !== DesignElementKind.Line) return base;
  return {
    ...base,
    strokeWidth: clamp(
      Math.round(base.strokeWidth * scale),
      DESIGN_LIMITS.minStroke,
      DESIGN_LIMITS.maxStroke,
    ),
  };
};

export const resizeDocument = (
  document: DesignDocument,
  from: DesignPreset,
  to: DesignPreset,
): DesignDocument => {
  const target = DESIGN_PRESET_SIZE[to];
  return {
    ...document,
    pages: document.pages.map((page) => {
      const source = pageSizeOf(page, from);
      const scale = Math.min(target.width / source.width, target.height / source.height);
      const offset = {
        x: (target.width - source.width * scale) / 2,
        y: (target.height - source.height * scale) / 2,
      };
      return {
        id: page.id,
        background: page.background,
        elements: page.elements.map((element) => scaleElement(element, scale, offset)),
      };
    }),
  };
};

export type Box = { x: number; y: number; width: number; height: number };
export type SnapResult = { dx: number; dy: number; guidesX: number[]; guidesY: number[] };
export type SnapTargets = { xs: number[]; ys: number[] };

export const snapTargets = (
  page: DesignPage,
  size: PageSize,
  excludeIds: readonly string[],
): SnapTargets => {
  const others = page.elements.filter(
    (element) => !excludeIds.includes(element.id) && element.rotation === 0,
  );
  return {
    xs: [
      0,
      size.width / 2,
      size.width,
      ...others.flatMap((element) => [
        element.x,
        element.x + element.width / 2,
        element.x + element.width,
      ]),
    ],
    ys: [
      0,
      size.height / 2,
      size.height,
      ...others.flatMap((element) => [
        element.y,
        element.y + element.height / 2,
        element.y + element.height,
      ]),
    ],
  };
};

type Match = { delta: number; line: number };

const closest = (edges: number[], targets: number[], threshold: number): Match | null =>
  edges
    .flatMap((edge) => targets.map((target) => ({ delta: target - edge, line: target })))
    .filter((match) => Math.abs(match.delta) <= threshold)
    .reduce<Match | null>(
      (best, match) =>
        best === null || Math.abs(match.delta) < Math.abs(best.delta) ? match : best,
      null,
    );

export const snapBox = (box: Box, targets: SnapTargets, threshold: number): SnapResult => {
  const x = closest([box.x, box.x + box.width / 2, box.x + box.width], targets.xs, threshold);
  const y = closest([box.y, box.y + box.height / 2, box.y + box.height], targets.ys, threshold);
  return {
    dx: x?.delta ?? 0,
    dy: y?.delta ?? 0,
    guidesX: x === null ? [] : [x.line],
    guidesY: y === null ? [] : [y.line],
  };
};

export const boundsOf = (elements: readonly DesignElement[]): Box | null => {
  if (elements.length === 0) return null;
  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const right = Math.max(...elements.map((element) => element.x + element.width));
  const bottom = Math.max(...elements.map((element) => element.y + element.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const brandFontsOf = (names: readonly string[]): DesignFont[] => {
  const wanted = names.map((name) => name.trim().toLowerCase());
  return Object.values(DesignFont).filter((font) =>
    wanted.includes(DESIGN_FONT_LABEL[font].toLowerCase()),
  );
};
