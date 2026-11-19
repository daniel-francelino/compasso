import { type Failure, type Result, invalid } from "@/lib/shared/server-utils";

export type Matrix = readonly [number, number, number, number, number, number];

export type Point = { x: number; y: number };

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const DEGREES_TO_RADIANS = Math.PI / 180;
const MIN_DETERMINANT = 1e-12;

export const MatrixFailure = {
  NotFinite: "matrix_not_finite",
  Singular: "matrix_singular",
} as const;

const failure = (reason: string): Failure => invalid(reason);

export const matrix = (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): Matrix => [a, b, c, d, e, f];

export const translate = (tx: number, ty = 0): Matrix => [1, 0, 0, 1, tx, ty];

export const scale = (sx: number, sy = sx): Matrix => [sx, 0, 0, sy, 0, 0];

export const skewX = (degrees: number): Matrix => [
  1,
  0,
  Math.tan(degrees * DEGREES_TO_RADIANS),
  1,
  0,
  0,
];

export const skewY = (degrees: number): Matrix => [
  1,
  Math.tan(degrees * DEGREES_TO_RADIANS),
  0,
  1,
  0,
  0,
];

export const compose = (outer: Matrix, inner: Matrix): Matrix => {
  const [a1, b1, c1, d1, e1, f1] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
};

export const rotate = (degrees: number, cx = 0, cy = 0): Matrix => {
  const radians = degrees * DEGREES_TO_RADIANS;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const turn: Matrix = [cos, sin, -sin, cos, 0, 0];
  if (cx === 0 && cy === 0) return turn;
  return compose(translate(cx, cy), compose(turn, translate(-cx, -cy)));
};

export const composeAll = (list: readonly Matrix[]): Matrix =>
  list.reduce<Matrix>((total, next) => compose(total, next), IDENTITY);

export const isFiniteMatrix = (m: Matrix): boolean => m.every((value) => Number.isFinite(value));

export const applyToPoint = (m: Matrix, p: Point): Point => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
});

export const determinant = (m: Matrix): number => m[0] * m[3] - m[1] * m[2];

export const invert = (m: Matrix): Result<{ matrix: Matrix }> => {
  if (!isFiniteMatrix(m)) return failure(MatrixFailure.NotFinite);
  const det = determinant(m);
  if (!Number.isFinite(det) || Math.abs(det) < MIN_DETERMINANT) {
    return failure(MatrixFailure.Singular);
  }
  const [a, b, c, d, e, f] = m;
  const inverse: Matrix = [
    d / det,
    -b / det,
    -c / det,
    a / det,
    (c * f - d * e) / det,
    (b * e - a * f) / det,
  ];
  if (!isFiniteMatrix(inverse)) return failure(MatrixFailure.NotFinite);
  return { ok: true, matrix: inverse };
};
