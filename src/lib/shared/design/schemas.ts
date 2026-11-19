import { z } from "zod";
import { storedDesignMetadataSchema } from "@/lib/shared/design/import/metadata";
import { adjustmentSchema } from "@/lib/shared/design/raster/adjustment-schemas";
import {
  DESIGN_LIMITS,
  DesignBlendMode,
  DesignElementKind,
  DesignExportFormat,
  DesignFont,
  DesignPathCap,
  DesignPathFillRule,
  DesignPathJoin,
  DesignPathPaintKind,
  DesignPreset,
  DesignStatusFilter,
  DesignTextAlign,
} from "@/lib/shared/design/types";

export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/);

const coordinate = z.number().min(-DESIGN_LIMITS.maxCoordinate).max(DESIGN_LIMITS.maxCoordinate);
const size = z.number().min(DESIGN_LIMITS.minSize).max(DESIGN_LIMITS.maxSize);
const elementId = z.string().min(1).max(40);

export const layerMaskSchema = z.object({
  mediaVersionId: z.string().uuid().nullable().default(null),
  enabled: z.boolean().default(true),
  linked: z.boolean().default(true),
});

const baseElement = {
  id: elementId,
  x: coordinate,
  y: coordinate,
  width: size,
  height: size,
  rotation: z.number().min(-360).max(360),
  opacity: z.number().min(0).max(1),
  locked: z.boolean(),
  groupId: elementId.nullable().default(null),
  blendMode: z.nativeEnum(DesignBlendMode).default(DesignBlendMode.Normal),
  fillOpacity: z.number().min(0).max(1).default(1),
  name: z.string().max(DESIGN_LIMITS.layerNameMax).default(""),
  hidden: z.boolean().default(false),
  parentId: elementId.nullable().default(null),
  clipToBelow: z.boolean().default(false),
  mask: layerMaskSchema.nullable().default(null),
};

export const textShadowSchema = z.object({
  color: hexColorSchema,
  blur: z.number().min(0).max(DESIGN_LIMITS.maxShadowBlur),
  offsetX: z.number().min(-DESIGN_LIMITS.maxShadowOffset).max(DESIGN_LIMITS.maxShadowOffset),
  offsetY: z.number().min(-DESIGN_LIMITS.maxShadowOffset).max(DESIGN_LIMITS.maxShadowOffset),
});

export const textElementSchema = z.object({
  ...baseElement,
  kind: z.literal(DesignElementKind.Text),
  text: z.string().max(DESIGN_LIMITS.maxText),
  font: z.nativeEnum(DesignFont),
  fontSize: z.number().min(DESIGN_LIMITS.minFontSize).max(DESIGN_LIMITS.maxFontSize),
  bold: z.boolean(),
  italic: z.boolean(),
  color: hexColorSchema,
  align: z.nativeEnum(DesignTextAlign),
  lineHeight: z.number().min(DESIGN_LIMITS.minLineHeight).max(DESIGN_LIMITS.maxLineHeight),
  shadow: textShadowSchema.nullable().default(null),
});

export const imageElementSchema = z.object({
  ...baseElement,
  kind: z.literal(DesignElementKind.Image),
  mediaVersionId: z.string().uuid(),
  flipX: z.boolean(),
  flipY: z.boolean(),
  zoom: z.number().min(DESIGN_LIMITS.minZoom).max(DESIGN_LIMITS.maxZoom).default(1),
  focusX: z.number().min(0).max(1).default(0.5),
  focusY: z.number().min(0).max(1).default(0.5),
  brightness: z
    .number()
    .min(-DESIGN_LIMITS.maxBrightness)
    .max(DESIGN_LIMITS.maxBrightness)
    .default(0),
  contrast: z.number().min(-DESIGN_LIMITS.maxContrast).max(DESIGN_LIMITS.maxContrast).default(0),
  alt: z.string().max(DESIGN_LIMITS.maxAlt).default(""),
});

export const rectElementSchema = z.object({
  ...baseElement,
  kind: z.literal(DesignElementKind.Rect),
  fill: hexColorSchema,
  cornerRadius: z.number().min(0).max(DESIGN_LIMITS.maxCornerRadius),
});

export const ellipseElementSchema = z.object({
  ...baseElement,
  kind: z.literal(DesignElementKind.Ellipse),
  fill: hexColorSchema,
});

export const lineElementSchema = z.object({
  ...baseElement,
  kind: z.literal(DesignElementKind.Line),
  stroke: hexColorSchema,
  strokeWidth: z.number().min(DESIGN_LIMITS.minStroke).max(DESIGN_LIMITS.maxStroke),
  dashed: z.boolean(),
});

export const rasterElementSchema = z.object({
  ...baseElement,
  kind: z.literal(DesignElementKind.Raster),
  pixelsVersionId: z.string().uuid().nullable().default(null),
  pixelWidth: z.number().int().min(1).max(DESIGN_LIMITS.maxRasterSide),
  pixelHeight: z.number().int().min(1).max(DESIGN_LIMITS.maxRasterSide),
});

export const adjustmentElementSchema = z.object({
  ...baseElement,
  kind: z.literal(DesignElementKind.Adjustment),
  adjustment: adjustmentSchema,
});

export const groupElementSchema = z.object({
  ...baseElement,
  kind: z.literal(DesignElementKind.Group),
  collapsed: z.boolean().default(false),
  passThrough: z.boolean().default(false),
});

const PATH_DATA_ALPHABET = /^[MLCQZ0-9.eE+, -]+$/;
const PATH_COMMAND_LETTERS = /[MLCQZ]/g;

const pathData = z
  .string()
  .min(1)
  .max(DESIGN_LIMITS.maxPathData)
  .regex(PATH_DATA_ALPHABET)
  .refine((value) => {
    const commands = value.match(PATH_COMMAND_LETTERS)?.length ?? 0;
    return commands >= 1 && commands <= DESIGN_LIMITS.maxPathCommands;
  });

const fraction = z.number().min(0).max(1);
const viewSide = z.number().min(DESIGN_LIMITS.minSize).max(DESIGN_LIMITS.maxSize);

export const pathGradientStopSchema = z.object({
  offset: fraction,
  color: hexColorSchema,
  alpha: fraction,
});

const gradientStops = z
  .array(pathGradientStopSchema)
  .min(DESIGN_LIMITS.minGradientStops)
  .max(DESIGN_LIMITS.maxGradientStops);

export const pathPaintSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(DesignPathPaintKind.Solid), color: hexColorSchema }),
  z.object({
    kind: z.literal(DesignPathPaintKind.Linear),
    x1: fraction,
    y1: fraction,
    x2: fraction,
    y2: fraction,
    stops: gradientStops,
  }),
  z.object({
    kind: z.literal(DesignPathPaintKind.Radial),
    cx: fraction,
    cy: fraction,
    r: z.number().gt(0).max(1),
    stops: gradientStops,
  }),
]);

export const pathStrokeSchema = z.object({
  color: hexColorSchema,
  width: z.number().min(DESIGN_LIMITS.minPathStrokeWidth).max(DESIGN_LIMITS.maxPathStrokeWidth),
  cap: z.nativeEnum(DesignPathCap),
  join: z.nativeEnum(DesignPathJoin),
  miterLimit: z.number().min(DESIGN_LIMITS.minMiterLimit).max(DESIGN_LIMITS.maxMiterLimit),
  dashed: z.boolean(),
});

export const pathElementSchema = z.object({
  ...baseElement,
  kind: z.literal(DesignElementKind.Path),
  d: pathData,
  viewWidth: viewSide,
  viewHeight: viewSide,
  fill: pathPaintSchema.nullable(),
  stroke: pathStrokeSchema.nullable(),
  fillRule: z.nativeEnum(DesignPathFillRule),
});

const legacyElementSchema = z.discriminatedUnion("kind", [
  textElementSchema,
  imageElementSchema,
  rectElementSchema,
  ellipseElementSchema,
  lineElementSchema,
]);

const elementSchemasV3 = [
  textElementSchema,
  imageElementSchema,
  rectElementSchema,
  ellipseElementSchema,
  lineElementSchema,
  rasterElementSchema,
  adjustmentElementSchema,
  groupElementSchema,
] as const;

export const designElementSchemaV3 = z.discriminatedUnion("kind", elementSchemasV3);

export const designElementSchema = z.discriminatedUnion("kind", [
  ...elementSchemasV3,
  pathElementSchema,
]);

const pageSide = z.number().int().min(DESIGN_LIMITS.minPageSide).max(DESIGN_LIMITS.maxPageSide);

const pageShape = {
  id: elementId,
  background: hexColorSchema.nullable(),
  width: pageSide.optional(),
  height: pageSide.optional(),
};

export const designPageSchema = z.object({
  ...pageShape,
  elements: z.array(designElementSchema).max(DESIGN_LIMITS.maxElements),
});

const designPageSchemaV3 = z.object({
  ...pageShape,
  elements: z.array(designElementSchemaV3).max(DESIGN_LIMITS.maxElements),
});

const legacyPageSchema = z.object({
  id: elementId,
  background: hexColorSchema.nullable(),
  elements: z.array(legacyElementSchema).max(DESIGN_LIMITS.maxElementsV2),
});

type ParentLink = { id: string; kind: string; parentId: string | null };

const parentChainValid = (element: ParentLink, byId: ReadonlyMap<string, ParentLink>): boolean => {
  let current = element.parentId;
  let depth = 0;
  while (current !== null) {
    depth += 1;
    const parent = byId.get(current);
    const broken =
      depth > DESIGN_LIMITS.maxGroupDepth ||
      current === element.id ||
      parent === undefined ||
      parent.kind !== DesignElementKind.Group;
    if (broken) return false;
    current = parent.parentId;
  }
  return true;
};

const documentIssues = (
  pages: readonly z.infer<typeof designPageSchema>[],
  maxElements: number,
) => {
  const elements = pages.flatMap((page) => page.elements);
  const pageIds = new Set(pages.map((page) => page.id));
  const elementIds = new Set(elements.map((element) => element.id));
  if (elements.length > maxElements) return true;
  if (pageIds.size !== pages.length || elementIds.size !== elements.length) return true;
  return pages.some((page) => {
    const byId = new Map(page.elements.map((element) => [element.id, element]));
    return page.elements.some((element) => !parentChainValid(element, byId));
  });
};

export const designDocumentV4Schema = z
  .object({
    version: z.literal(4),
    pages: z.array(designPageSchema).min(1).max(DESIGN_LIMITS.maxPages),
  })
  .superRefine((document, context) => {
    if (documentIssues(document.pages, DESIGN_LIMITS.maxElements)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["pages"] });
    }
  });

export const designDocumentV3Schema = z
  .object({
    version: z.literal(3),
    pages: z.array(designPageSchemaV3).min(1).max(DESIGN_LIMITS.maxPages),
  })
  .superRefine((document, context) => {
    if (documentIssues(document.pages, DESIGN_LIMITS.maxElements)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["pages"] });
    }
  })
  .transform((document) => ({ version: 4 as const, pages: document.pages }));

export const designDocumentV2Schema = z
  .object({
    version: z.literal(2),
    pages: z.array(legacyPageSchema).min(1).max(DESIGN_LIMITS.maxPages),
  })
  .superRefine((document, context) => {
    const elements = document.pages.flatMap((page) => page.elements);
    const pageIds = new Set(document.pages.map((page) => page.id));
    const elementIds = new Set(elements.map((element) => element.id));
    if (elements.length > DESIGN_LIMITS.maxElementsV2) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["pages"] });
    }
    if (pageIds.size !== document.pages.length || elementIds.size !== elements.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["pages"] });
    }
  })
  .transform((document) => ({ version: 4 as const, pages: document.pages }));

const designDocumentV1Schema = z
  .object({
    version: z.literal(1),
    background: hexColorSchema.nullable(),
    elements: z.array(legacyElementSchema).max(DESIGN_LIMITS.maxElementsV2),
  })
  .transform((document) => ({
    version: 4 as const,
    pages: [{ id: "page-1", background: document.background, elements: document.elements }],
  }));

export const designDocumentSchema = z.union([
  designDocumentV4Schema,
  designDocumentV3Schema,
  designDocumentV2Schema,
  designDocumentV1Schema,
]);

export type TextShadow = z.infer<typeof textShadowSchema>;
export type TextElement = z.infer<typeof textElementSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type RectElement = z.infer<typeof rectElementSchema>;
export type EllipseElement = z.infer<typeof ellipseElementSchema>;
export type LineElement = z.infer<typeof lineElementSchema>;
export type RasterElement = z.infer<typeof rasterElementSchema>;
export type AdjustmentElement = z.infer<typeof adjustmentElementSchema>;
export type PathElement = z.infer<typeof pathElementSchema>;
export type PathPaint = z.infer<typeof pathPaintSchema>;
export type PathStroke = z.infer<typeof pathStrokeSchema>;
export type GroupElement = z.infer<typeof groupElementSchema>;
export type LayerMask = z.infer<typeof layerMaskSchema>;
export type DesignElement = z.infer<typeof designElementSchema>;
export type DesignPage = z.infer<typeof designPageSchema>;
export type DesignDocument = z.infer<typeof designDocumentV4Schema>;

const designName = z.string().trim().min(1).max(DESIGN_LIMITS.nameMax);
const expectedVersion = z.number().int().min(1);
const designId = z.string().uuid();

export const listDesignsSchema = z.object({
  search: z.string().max(100).default(""),
  page: z.number().int().min(1).max(10000).default(1),
  status: z.nativeEnum(DesignStatusFilter).default(DesignStatusFilter.Active),
  brandId: z.string().uuid().optional(),
});

export const designIdSchema = z.object({ id: designId });

export const brandIdSchema = z.object({ brandId: z.string().uuid() });

export const createDesignSchema = z.object({
  brandId: z.string().uuid(),
  name: designName,
  preset: z.nativeEnum(DesignPreset),
  document: designDocumentV4Schema.optional(),
});

export const saveDesignDraftSchema = z.object({
  id: designId,
  document: designDocumentV4Schema,
  expectedVersion,
});

export const renameDesignSchema = z.object({ id: designId, name: designName, expectedVersion });

export const saveDesignVersionSchema = z.object({ id: designId, expectedVersion });

export const setDesignTrashedSchema = z.object({ id: designId, trashed: z.boolean() });

export const restoreDesignVersionSchema = z.object({
  id: designId,
  versionNo: z.number().int().min(1),
  expectedVersion,
});

export const setDesignTemplateSchema = z.object({
  id: designId,
  template: z.boolean(),
  expectedVersion,
});

export const recordDesignExportSchema = z.object({
  id: designId,
  versionNo: z.number().int().min(1),
  pageNo: z.number().int().min(1).max(DESIGN_LIMITS.maxPages),
  format: z.nativeEnum(DesignExportFormat),
  scale: z.union([z.literal(1), z.literal(2)]),
  mediaVersionId: z.string().uuid(),
});

export const recordDesignImportSchema = z
  .object({
    id: designId,
    metadata: storedDesignMetadataSchema,
  })
  .strict();
