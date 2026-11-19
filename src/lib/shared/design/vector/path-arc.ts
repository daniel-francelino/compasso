import type { PathCommand } from "@/lib/shared/design/vector/path-types";

const QUARTER_TURN = Math.PI / 2;
const SEGMENT_EPSILON = 1e-9;

export type ArcInput = {
  x0: number;
  y0: number;
  rx: number;
  ry: number;
  rotation: number;
  largeArc: boolean;
  sweep: boolean;
  x: number;
  y: number;
};

type Center = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  theta: number;
  delta: number;
  cos: number;
  sin: number;
};

const centerOf = (arc: ArcInput): Center | null => {
  const phi = (arc.rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (arc.x0 - arc.x) / 2;
  const dy = (arc.y0 - arc.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let rx = Math.abs(arc.rx);
  let ry = Math.abs(arc.ry);
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    const grow = Math.sqrt(lambda);
    rx *= grow;
    ry *= grow;
  }
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const denominator = rx2 * y1 * y1 + ry2 * x1 * x1;
  if (denominator === 0 || !Number.isFinite(denominator)) return null;
  const sign = arc.largeArc === arc.sweep ? -1 : 1;
  const coefficient = sign * Math.sqrt(Math.max(0, (rx2 * ry2 - denominator) / denominator));
  const cxp = (coefficient * rx * y1) / ry;
  const cyp = (-coefficient * ry * x1) / rx;
  const theta = Math.atan2((y1 - cyp) / ry, (x1 - cxp) / rx);
  const end = Math.atan2((-y1 - cyp) / ry, (-x1 - cxp) / rx);
  let delta = end - theta;
  if (!arc.sweep && delta > 0) delta -= 2 * Math.PI;
  if (arc.sweep && delta < 0) delta += 2 * Math.PI;
  return {
    cx: cos * cxp - sin * cyp + (arc.x0 + arc.x) / 2,
    cy: sin * cxp + cos * cyp + (arc.y0 + arc.y) / 2,
    rx,
    ry,
    theta,
    delta,
    cos,
    sin,
  };
};

const mapPoint = (center: Center, ux: number, uy: number): { x: number; y: number } => ({
  x: center.cx + center.rx * ux * center.cos - center.ry * uy * center.sin,
  y: center.cy + center.rx * ux * center.sin + center.ry * uy * center.cos,
});

export const arcToCommands = (arc: ArcInput): PathCommand[] => {
  if (arc.x0 === arc.x && arc.y0 === arc.y) return [];
  const line: PathCommand = { type: "L", x: arc.x, y: arc.y };
  if (arc.rx === 0 || arc.ry === 0) return [line];
  const center = centerOf(arc);
  if (center === null) return [line];
  const count = Math.max(1, Math.ceil(Math.abs(center.delta) / QUARTER_TURN - SEGMENT_EPSILON));
  const step = center.delta / count;
  const handle = (4 / 3) * Math.tan(step / 4);
  const commands: PathCommand[] = [];
  for (let index = 0; index < count; index += 1) {
    const t1 = center.theta + index * step;
    const t2 = t1 + step;
    const c1 = mapPoint(
      center,
      Math.cos(t1) - handle * Math.sin(t1),
      Math.sin(t1) + handle * Math.cos(t1),
    );
    const c2 = mapPoint(
      center,
      Math.cos(t2) + handle * Math.sin(t2),
      Math.sin(t2) - handle * Math.cos(t2),
    );
    const last = index === count - 1;
    const end = last ? { x: arc.x, y: arc.y } : mapPoint(center, Math.cos(t2), Math.sin(t2));
    commands.push({ type: "C", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: end.x, y: end.y });
  }
  return commands;
};
