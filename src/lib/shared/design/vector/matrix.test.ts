import { describe, expect, it } from "vitest";
import {
  IDENTITY,
  MatrixFailure,
  applyToPoint,
  compose,
  composeAll,
  invert,
  matrix,
  rotate,
  scale,
  skewX,
  skewY,
  translate,
} from "@/lib/shared/design/vector/matrix";

describe("vector matrix", () => {
  it("applies translate, scale and matrix to a point", () => {
    expect(applyToPoint(translate(5, -3), { x: 1, y: 1 })).toEqual({ x: 6, y: -2 });
    expect(applyToPoint(scale(2, 3), { x: 1, y: 1 })).toEqual({ x: 2, y: 3 });
    expect(applyToPoint(scale(2), { x: 1, y: 1 })).toEqual({ x: 2, y: 2 });
    expect(applyToPoint(matrix(1, 2, 3, 4, 5, 6), { x: 1, y: 1 })).toEqual({ x: 9, y: 12 });
  });

  it("rotates around the origin and around a center", () => {
    const quarter = applyToPoint(rotate(90), { x: 1, y: 0 });
    expect(quarter.x).toBeCloseTo(0, 9);
    expect(quarter.y).toBeCloseTo(1, 9);
    const around = applyToPoint(rotate(180, 10, 10), { x: 12, y: 10 });
    expect(around.x).toBeCloseTo(8, 9);
    expect(around.y).toBeCloseTo(10, 9);
  });

  it("skews on each axis", () => {
    const x = applyToPoint(skewX(45), { x: 0, y: 2 });
    expect(x.x).toBeCloseTo(2, 9);
    const y = applyToPoint(skewY(45), { x: 2, y: 0 });
    expect(y.y).toBeCloseTo(2, 9);
  });

  it("composes with the outer matrix applied last", () => {
    const both = compose(translate(10, 0), scale(2));
    expect(applyToPoint(both, { x: 1, y: 1 })).toEqual({ x: 12, y: 2 });
    const reversed = compose(scale(2), translate(10, 0));
    expect(applyToPoint(reversed, { x: 1, y: 1 })).toEqual({ x: 22, y: 2 });
    expect(composeAll([translate(10, 0), scale(2)])).toEqual(both);
    expect(composeAll([])).toEqual(IDENTITY);
  });

  it("inverts a matrix and round-trips a point", () => {
    const m = compose(translate(7, -4), compose(rotate(33), scale(2, 0.5)));
    const inverse = invert(m);
    expect(inverse.ok).toBe(true);
    if (!inverse.ok) return;
    const point = applyToPoint(inverse.matrix, applyToPoint(m, { x: 3, y: 9 }));
    expect(point.x).toBeCloseTo(3, 9);
    expect(point.y).toBeCloseTo(9, 9);
  });

  it("refuses singular and non finite matrices without throwing", () => {
    const singular = invert(scale(0, 1));
    expect(singular.ok).toBe(false);
    if (!singular.ok) expect(singular.message).toBe(MatrixFailure.Singular);
    const nan = invert(matrix(Number.NaN, 0, 0, 1, 0, 0));
    expect(nan.ok).toBe(false);
    if (!nan.ok) expect(nan.message).toBe(MatrixFailure.NotFinite);
    expect(invert(scale(1e-200, 1e-200)).ok).toBe(false);
  });
});
