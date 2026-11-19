import { expect } from "vitest";
import { sanitizeImportName } from "@/lib/shared/design/import/sanitize";
import type { SvgVectorDocument } from "@/lib/shared/design/import/handlers/svg-vector-types";
import { pathPaintSchema, pathStrokeSchema } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignPathFillRule } from "@/lib/shared/design/types";
import { validatePathData } from "@/lib/shared/design/vector/path-data";

const UNASSIGNED = /\p{Cn}/u;
const LIMITS = {
  maxData: DESIGN_LIMITS.maxPathData,
  maxCommands: DESIGN_LIMITS.maxPathCommands,
  maxCoordinate: DESIGN_LIMITS.maxCoordinate,
};

export const expectValidShapes = (document: SvgVectorDocument): void => {
  expect(document.shapes.length).toBeGreaterThan(0);
  for (const shape of document.shapes) {
    expect(pathPaintSchema.nullable().safeParse(shape.fill).success).toBe(true);
    expect(pathStrokeSchema.nullable().safeParse(shape.stroke).success).toBe(true);
    expect(Object.values(DesignPathFillRule)).toContain(shape.fillRule);
    expect(Number.isFinite(shape.opacity) && shape.opacity > 0 && shape.opacity <= 1).toBe(true);
    expect(validatePathData(shape.d, LIMITS).ok).toBe(true);
    expect(Object.values(shape.bounds).every((value) => Number.isFinite(value))).toBe(true);
    expect(shape.fill !== null || shape.stroke !== null).toBe(true);
    if (shape.name === null) continue;
    expect(shape.name.length).toBeLessThanOrEqual(DESIGN_LIMITS.layerNameMax);
    expect(sanitizeImportName(shape.name)).toBe(shape.name);
    expect(UNASSIGNED.test(shape.name)).toBe(false);
  }
};
