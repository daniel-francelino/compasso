import {
  type Box,
  type DesignPalette,
  type ElementPatch,
  boundsOf,
  createLine,
  createShape,
  createText,
  expandSelection,
  normalizeRotation,
  patchElements,
} from "@/lib/shared/design/document";
import type { DesignElement, DesignPage, LineElement } from "@/lib/shared/design/schemas";
import {
  DESIGN_LIMITS,
  DesignAlign,
  DesignDistribute,
  DesignElementKind,
  type DesignPreset,
  DesignTool,
  type PageSize,
} from "@/lib/shared/design/types";
import { type Point, boxFromPoints, snapAngle } from "@/lib/shared/design/viewport";

export type DrawTool =
  | typeof DesignTool.Text
  | typeof DesignTool.Rect
  | typeof DesignTool.Ellipse
  | typeof DesignTool.Line;

const DRAW_TOOLS: readonly DesignTool[] = [
  DesignTool.Text,
  DesignTool.Rect,
  DesignTool.Ellipse,
  DesignTool.Line,
];

export const isDrawTool = (tool: DesignTool): tool is DrawTool => DRAW_TOOLS.includes(tool);

type Unit = { ids: string[]; box: Box };
type Shift = { x: number; y: number };

const movableOf = (page: DesignPage, ids: readonly string[]): DesignElement[] =>
  page.elements.filter((element) => ids.includes(element.id) && !element.locked);

const unitsOf = (elements: readonly DesignElement[]): Unit[] => {
  const byKey = new Map<string, DesignElement[]>();
  for (const element of elements) {
    const key = element.groupId ?? element.id;
    byKey.set(key, [...(byKey.get(key) ?? []), element]);
  }
  return [...byKey.values()].flatMap((members) => {
    const box = boundsOf(members);
    return box === null ? [] : [{ ids: members.map((member) => member.id), box }];
  });
};

const shiftUnits = (
  page: DesignPage,
  moves: readonly { ids: readonly string[]; shift: Shift }[],
): DesignPage => {
  const patches: ElementPatch[] = moves.flatMap(({ ids, shift }) =>
    page.elements
      .filter((element) => ids.includes(element.id))
      .map((element) => ({
        id: element.id,
        patch: { x: Math.round(element.x + shift.x), y: Math.round(element.y + shift.y) },
      })),
  );
  return patchElements(page, patches);
};

const ALIGN_SHIFT: Record<DesignAlign, (box: Box, frame: Box) => Shift> = {
  [DesignAlign.Left]: (box, frame) => ({ x: frame.x - box.x, y: 0 }),
  [DesignAlign.CenterX]: (box, frame) => ({
    x: frame.x + frame.width / 2 - (box.x + box.width / 2),
    y: 0,
  }),
  [DesignAlign.Right]: (box, frame) => ({ x: frame.x + frame.width - (box.x + box.width), y: 0 }),
  [DesignAlign.Top]: (box, frame) => ({ x: 0, y: frame.y - box.y }),
  [DesignAlign.CenterY]: (box, frame) => ({
    x: 0,
    y: frame.y + frame.height / 2 - (box.y + box.height / 2),
  }),
  [DesignAlign.Bottom]: (box, frame) => ({
    x: 0,
    y: frame.y + frame.height - (box.y + box.height),
  }),
};

export const alignsToPage = (page: DesignPage, ids: readonly string[]): boolean =>
  unitsOf(movableOf(page, ids)).length === 1;

export const alignElements = (
  page: DesignPage,
  ids: readonly string[],
  align: DesignAlign,
  size: PageSize,
): DesignPage => {
  const movable = movableOf(page, ids);
  const units = unitsOf(movable);
  const frame =
    units.length === 1 ? { x: 0, y: 0, width: size.width, height: size.height } : boundsOf(movable);
  if (frame === null) return page;
  return shiftUnits(
    page,
    units.map((unit) => ({ ids: unit.ids, shift: ALIGN_SHIFT[align](unit.box, frame) })),
  );
};

const AXIS: Record<DesignDistribute, { start: "x" | "y"; size: "width" | "height" }> = {
  [DesignDistribute.Horizontal]: { start: "x", size: "width" },
  [DesignDistribute.Vertical]: { start: "y", size: "height" },
};

export const canDistribute = (page: DesignPage, ids: readonly string[]): boolean =>
  unitsOf(movableOf(page, ids)).length >= 3;

export const distributeElements = (
  page: DesignPage,
  ids: readonly string[],
  axis: DesignDistribute,
): DesignPage => {
  const { start, size } = AXIS[axis];
  const units = unitsOf(movableOf(page, ids)).sort((a, b) => a.box[start] - b.box[start]);
  const first = units[0];
  const last = units.at(-1);
  if (units.length < 3 || first === undefined || last === undefined) return page;
  const span = last.box[start] + last.box[size] - first.box[start];
  const used = units.reduce((total, unit) => total + unit.box[size], 0);
  const gap = (span - used) / (units.length - 1);
  let cursor = first.box[start];
  const moves = units.map((unit) => {
    const delta = cursor - unit.box[start];
    cursor += unit.box[size] + gap;
    return { ids: unit.ids, shift: start === "x" ? { x: delta, y: 0 } : { x: 0, y: delta } };
  });
  return shiftUnits(page, moves);
};

export const selectionBox = (page: DesignPage, ids: readonly string[]): Box | null =>
  boundsOf(page.elements.filter((element) => ids.includes(element.id)));

export const transformSelection = (
  page: DesignPage,
  ids: readonly string[],
  target: Box,
): DesignPage => {
  const movable = movableOf(page, ids);
  const from = boundsOf(movable);
  if (from === null) return page;
  const scaleX = from.width === 0 ? 1 : target.width / from.width;
  const scaleY = from.height === 0 ? 1 : target.height / from.height;
  const patches: ElementPatch[] = movable.map((element) => ({
    id: element.id,
    patch: {
      x: Math.round(target.x + (element.x - from.x) * scaleX),
      y: Math.round(target.y + (element.y - from.y) * scaleY),
      width: Math.max(DESIGN_LIMITS.minSize, Math.round(element.width * scaleX)),
      ...(element.kind === DesignElementKind.Text
        ? {}
        : { height: Math.max(DESIGN_LIMITS.minSize, Math.round(element.height * scaleY)) }),
    },
  }));
  return patchElements(page, patches);
};

const intersects = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export const selectInBox = (page: DesignPage, box: Box): string[] =>
  expandSelection(
    page,
    page.elements
      .filter((element) => !element.locked && intersects(element, box))
      .map((element) => element.id),
  );

export const selectAll = (page: DesignPage): string[] =>
  page.elements.filter((element) => !element.locked).map((element) => element.id);

export const placeInBox = <T extends DesignElement>(element: T, box: Box): T => ({
  ...element,
  x: box.x,
  y: box.y,
  width: Math.max(DESIGN_LIMITS.minSize, box.width),
  height:
    element.kind === DesignElementKind.Text
      ? element.height
      : Math.max(DESIGN_LIMITS.minSize, box.height),
});

export const centerAt = <T extends DesignElement>(element: T, point: Point): T => ({
  ...element,
  x: Math.round(point.x - element.width / 2),
  y: Math.round(point.y - element.height / 2),
});

export const lineBetween = (element: LineElement, start: Point, end: Point): LineElement => {
  const width = Math.max(
    DESIGN_LIMITS.minSize,
    Math.round(Math.hypot(end.x - start.x, end.y - start.y)),
  );
  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;
  return {
    ...element,
    width,
    x: Math.round(centerX - width / 2),
    y: Math.round(centerY - element.height / 2),
    rotation: normalizeRotation((Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI),
  };
};

export type DrawSpec = {
  tool: DrawTool;
  id: string;
  preset: DesignPreset;
  palette: DesignPalette;
  start: Point;
  end: Point | null;
  shift: boolean;
};

const drawnLine = ({ id, preset, palette, start, end, shift }: DrawSpec): DesignElement => {
  const line = createLine(id, preset, palette);
  if (end === null) return centerAt(line, start);
  return lineBetween(line, start, shift ? snapAngle(start, end) : end);
};

export const drawnElement = (spec: DrawSpec): DesignElement => {
  if (spec.tool === DesignTool.Line) return drawnLine(spec);
  const base =
    spec.tool === DesignTool.Text
      ? createText(spec.id, spec.preset, spec.palette)
      : createShape(
          spec.id,
          spec.tool === DesignTool.Rect ? DesignElementKind.Rect : DesignElementKind.Ellipse,
          spec.preset,
          spec.palette,
        );
  if (spec.end === null) return centerAt(base, spec.start);
  return placeInBox(base, boxFromPoints(spec.start, spec.end, spec.shift));
};
