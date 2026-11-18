import { z } from "zod";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import {
  countCodePoints,
  sanitizeImportName,
  sanitizeImportText,
} from "@/lib/shared/design/import/sanitize";
import {
  DesignImportColorMode,
  DesignImportFormat,
  DesignImportNoteKind,
  type ImportKindResult,
  type ImportNote,
} from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";
import type { ValueOf } from "@/lib/shared/utils";

export const METADATA_LIMITS = {
  version: 1,
  maxLayers: 1000,
  layerName: 200,
  blendMode: 40,
  maxTextRuns: 1000,
  textRun: 5000,
  textTotal: 100_000,
  maxFonts: 100,
  fontName: 200,
  maxColors: 64,
  storedJsonBytes: 1024 * 1024,
  jsonTextMargin: 64 * 1024,
  jsonBytes: 1024 * 1024 - 64 * 1024,
  maxSide: 300_000,
  maxPageCount: 1_000_000,
  maxFontSize: 10_000,
  maxCount: 10_000_000,
} as const;

export const MetadataLayerKind = {
  Raster: "raster",
  Group: "group",
  Text: "text",
  SmartObject: "smart_object",
  Adjustment: "adjustment",
  Shape: "shape",
  Unknown: "unknown",
} as const;
export type MetadataLayerKind = ValueOf<typeof MetadataLayerKind>;

export const MetadataColorSource = {
  Text: "text",
  Fill: "fill",
  Swatch: "swatch",
} as const;
export type MetadataColorSource = ValueOf<typeof MetadataColorSource>;

const BYTE_MAX = 255;
const FONT_SIZE_SCALE = 100;
const UTF16_UNITS_PER_CODE_POINT = 2;

const sanitizedName = (cap: number) =>
  z
    .string()
    .max(cap * UTF16_UNITS_PER_CODE_POINT)
    .refine((value) => sanitizeImportName(value, cap) === value, { message: "sanitized-name" });

const sanitizedText = (cap: number) =>
  z
    .string()
    .max(cap * UTF16_UNITS_PER_CODE_POINT)
    .refine((value) => sanitizeImportText(value, cap) === value, { message: "sanitized-text" });

const side = z.number().int().min(1).max(METADATA_LIMITS.maxSide);
const extent = z.number().int().min(0).max(METADATA_LIMITS.maxSide);
const coordinate = z.number().int().min(-METADATA_LIMITS.maxSide).max(METADATA_LIMITS.maxSide);
const channel = z.number().int().min(0).max(BYTE_MAX);
const tally = z.number().int().min(1).max(METADATA_LIMITS.maxCount);

const RgbSchema = z.object({ r: channel, g: channel, b: channel }).strict();

const BoundsSchema = z
  .object({ left: coordinate, top: coordinate, width: extent, height: extent })
  .strict();

const LayerSchema = z
  .object({
    index: z.number().int().min(0).max(METADATA_LIMITS.maxLayers),
    parentIndex: z.number().int().min(0).max(METADATA_LIMITS.maxLayers).nullable(),
    name: sanitizedName(METADATA_LIMITS.layerName),
    kind: z.nativeEnum(MetadataLayerKind),
    visible: z.boolean(),
    opacity: z.number().min(0).max(1),
    blendMode: sanitizedName(METADATA_LIMITS.blendMode),
    bounds: BoundsSchema.nullable(),
  })
  .strict();

const TextRunSchema = z
  .object({
    layerIndex: z.number().int().min(0).max(METADATA_LIMITS.maxLayers),
    text: sanitizedText(METADATA_LIMITS.textRun),
    fontName: sanitizedName(METADATA_LIMITS.fontName).nullable(),
    fontSize: z.number().min(0).max(METADATA_LIMITS.maxFontSize).nullable(),
    color: RgbSchema.nullable(),
  })
  .strict();

const FontSchema = z
  .object({ name: sanitizedName(METADATA_LIMITS.fontName), usageCount: tally })
  .strict();

const ColorSchema = z
  .object({
    r: channel,
    g: channel,
    b: channel,
    source: z.nativeEnum(MetadataColorSource),
    count: tally,
  })
  .strict();

const TruncationSchema = z
  .object({
    layers: z.boolean(),
    textRuns: z.boolean(),
    fonts: z.boolean(),
    colors: z.boolean(),
    textCharsDropped: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

const encoder = new TextEncoder();

const jsonBytesOf = (value: unknown): number => encoder.encode(JSON.stringify(value)).length;

type Shape = {
  layers: readonly { index: number; parentIndex: number | null }[];
  textRuns: readonly { layerIndex: number }[];
};

const isConsistent = (value: Shape): boolean =>
  value.layers.every(
    (layer, position) =>
      layer.index === position && (layer.parentIndex === null || layer.parentIndex < position),
  ) && value.textRuns.every((run) => run.layerIndex < value.layers.length);

const metadataObject = z
  .object({
    version: z.literal(METADATA_LIMITS.version),
    source: z
      .object({
        format: z.nativeEnum(DesignImportFormat),
        colorMode: z.nativeEnum(DesignImportColorMode),
        bitsPerChannel: z.number().int().min(1).max(64).nullable(),
        pageCount: z.number().int().min(1).max(METADATA_LIMITS.maxPageCount).nullable(),
      })
      .strict(),
    dimensions: z
      .object({ sourceWidth: side, sourceHeight: side, pageWidth: side, pageHeight: side })
      .strict(),
    layers: z.array(LayerSchema).max(METADATA_LIMITS.maxLayers),
    textRuns: z.array(TextRunSchema).max(METADATA_LIMITS.maxTextRuns),
    fonts: z.array(FontSchema).max(METADATA_LIMITS.maxFonts),
    colors: z.array(ColorSchema).max(METADATA_LIMITS.maxColors),
    truncation: TruncationSchema,
  })
  .strict();

const withChecks = <T extends Shape, I>(schema: z.ZodType<T, z.ZodTypeDef, I>) =>
  schema
    .refine(isConsistent, { message: "inconsistent-references" })
    .refine((value) => jsonBytesOf(value) <= METADATA_LIMITS.jsonBytes, {
      message: "metadata-too-large",
    });

export const importedDesignMetadataSchema = withChecks(metadataObject);
export const storedDesignMetadataSchema = withChecks(
  metadataObject.extend({ textRuns: z.tuple([]) }),
);
export type StoredDesignMetadata = z.infer<typeof storedDesignMetadataSchema>;
export type ImportedDesignMetadata = z.infer<typeof importedDesignMetadataSchema>;

export type MetadataRgb = { r: number; g: number; b: number };

export type MetadataLayerInput = {
  parentIndex: number | null;
  name: string;
  kind: MetadataLayerKind;
  visible: boolean;
  opacity: number;
  blendMode: string;
  bounds: { left: number; top: number; width: number; height: number } | null;
};

export type MetadataTextInput = {
  layerIndex: number;
  text: string;
  fontName: string | null;
  fontSize: number | null;
  color: MetadataRgb | null;
};

export type MetadataFontInput = { name: string; usageCount: number };

export type MetadataColorInput = MetadataRgb & { source: MetadataColorSource; count: number };

export type MetadataParts = {
  source: {
    format: DesignImportFormat;
    colorMode: DesignImportColorMode;
    bitsPerChannel: number | null;
    pageCount: number | null;
  };
  dimensions: { sourceWidth: number; sourceHeight: number; pageWidth: number; pageHeight: number };
  layers?: readonly MetadataLayerInput[];
  textRuns?: readonly MetadataTextInput[];
  fonts?: readonly MetadataFontInput[];
  colors?: readonly MetadataColorInput[];
};

const toInt = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.round(Math.min(max, Math.max(min, value)));
};

const toSide = (value: number): number => toInt(value, 1, METADATA_LIMITS.maxSide);

const toUnit = (value: number): number =>
  Number.isNaN(value) ? 1 : Math.min(1, Math.max(0, value));

const nullableInt = (value: number | null, min: number, max: number): number | null =>
  value === null || Number.isNaN(value) ? null : toInt(value, min, max);

const rgbOf = (color: MetadataRgb): MetadataRgb => ({
  r: toInt(color.r, 0, BYTE_MAX),
  g: toInt(color.g, 0, BYTE_MAX),
  b: toInt(color.b, 0, BYTE_MAX),
});

const layersOf = (inputs: readonly MetadataLayerInput[]) =>
  inputs.slice(0, METADATA_LIMITS.maxLayers).map((layer, index) => ({
    index,
    parentIndex: layer.parentIndex,
    name: sanitizeImportName(layer.name, METADATA_LIMITS.layerName),
    kind: layer.kind,
    visible: layer.visible,
    opacity: toUnit(layer.opacity),
    blendMode: sanitizeImportName(layer.blendMode, METADATA_LIMITS.blendMode),
    bounds:
      layer.bounds === null
        ? null
        : {
            left: toInt(layer.bounds.left, -METADATA_LIMITS.maxSide, METADATA_LIMITS.maxSide),
            top: toInt(layer.bounds.top, -METADATA_LIMITS.maxSide, METADATA_LIMITS.maxSide),
            width: toInt(layer.bounds.width, 0, METADATA_LIMITS.maxSide),
            height: toInt(layer.bounds.height, 0, METADATA_LIMITS.maxSide),
          },
  }));

type TextOutcome = {
  runs: z.infer<typeof TextRunSchema>[];
  cut: boolean;
  dropped: number;
};

const fontSizeOf = (value: number | null): number | null => {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return Math.min(
    METADATA_LIMITS.maxFontSize,
    Math.round(value * FONT_SIZE_SCALE) / FONT_SIZE_SCALE,
  );
};

const textRunsOf = (inputs: readonly MetadataTextInput[], layerCount: number): TextOutcome => {
  const outcome: TextOutcome = { runs: [], cut: false, dropped: 0 };
  let remaining = METADATA_LIMITS.textTotal;
  for (const input of inputs) {
    const original = countCodePoints(input.text);
    const unusable = input.layerIndex < 0 || input.layerIndex >= layerCount;
    if (unusable || outcome.runs.length >= METADATA_LIMITS.maxTextRuns) {
      outcome.cut = true;
      outcome.dropped += original;
      continue;
    }
    const limit = Math.min(METADATA_LIMITS.textRun, remaining);
    const text = sanitizeImportText(input.text, limit);
    const kept = countCodePoints(text);
    if (kept === limit && original > kept) {
      outcome.cut = true;
      outcome.dropped += original - kept;
    }
    if (text === "") continue;
    remaining -= kept;
    outcome.runs.push({
      layerIndex: input.layerIndex,
      text,
      fontName:
        input.fontName === null
          ? null
          : sanitizeImportName(input.fontName, METADATA_LIMITS.fontName),
      fontSize: fontSizeOf(input.fontSize),
      color: input.color === null ? null : rgbOf(input.color),
    });
  }
  return outcome;
};

const fontsOf = (inputs: readonly MetadataFontInput[]) => {
  const counts = new Map<string, number>();
  for (const input of inputs) {
    const name = sanitizeImportName(input.name, METADATA_LIMITS.fontName);
    if (name === "") continue;
    counts.set(name, (counts.get(name) ?? 0) + Math.max(1, Math.round(input.usageCount)));
  }
  const sorted = [...counts.entries()]
    .map(([name, usageCount]) => ({
      name,
      usageCount: Math.min(usageCount, METADATA_LIMITS.maxCount),
    }))
    .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name));
  return {
    fonts: sorted.slice(0, METADATA_LIMITS.maxFonts),
    cut: sorted.length > METADATA_LIMITS.maxFonts,
  };
};

const colorsOf = (inputs: readonly MetadataColorInput[]) => {
  const counts = new Map<string, z.infer<typeof ColorSchema>>();
  for (const input of inputs) {
    const rgb = rgbOf(input);
    const key = `${rgb.r},${rgb.g},${rgb.b},${input.source}`;
    const known = counts.get(key);
    const count = Math.max(1, Math.round(input.count));
    counts.set(key, {
      ...rgb,
      source: input.source,
      count: Math.min(METADATA_LIMITS.maxCount, (known?.count ?? 0) + count),
    });
  }
  const sorted = [...counts.values()].sort(
    (a, b) =>
      b.count - a.count || a.r - b.r || a.g - b.g || a.b - b.b || a.source.localeCompare(b.source),
  );
  return {
    colors: sorted.slice(0, METADATA_LIMITS.maxColors),
    cut: sorted.length > METADATA_LIMITS.maxColors,
  };
};

const assemble = (parts: MetadataParts) => {
  const layerInputs = parts.layers ?? [];
  const layers = layersOf(layerInputs);
  const text = textRunsOf(parts.textRuns ?? [], layers.length);
  const fonts = fontsOf(parts.fonts ?? []);
  const colors = colorsOf(parts.colors ?? []);
  return {
    version: METADATA_LIMITS.version,
    source: {
      format: parts.source.format,
      colorMode: parts.source.colorMode,
      bitsPerChannel: nullableInt(parts.source.bitsPerChannel, 1, 64),
      pageCount: nullableInt(parts.source.pageCount, 1, METADATA_LIMITS.maxPageCount),
    },
    dimensions: {
      sourceWidth: toSide(parts.dimensions.sourceWidth),
      sourceHeight: toSide(parts.dimensions.sourceHeight),
      pageWidth: toSide(parts.dimensions.pageWidth),
      pageHeight: toSide(parts.dimensions.pageHeight),
    },
    layers,
    textRuns: text.runs,
    fonts: fonts.fonts,
    colors: colors.colors,
    truncation: {
      layers: layerInputs.length > METADATA_LIMITS.maxLayers,
      textRuns: text.cut,
      fonts: fonts.cut,
      colors: colors.cut,
      textCharsDropped: text.dropped,
    },
  };
};

type Assembled = ReturnType<typeof assemble>;

export const withoutText = (value: ImportedDesignMetadata): StoredDesignMetadata => ({
  ...value,
  textRuns: [],
  truncation: {
    ...value.truncation,
    textRuns: true,
    textCharsDropped:
      value.truncation.textCharsDropped +
      value.textRuns.reduce((total, run) => total + countCodePoints(run.text), 0),
  },
});

const fitJsonCap = (value: Assembled): Assembled =>
  jsonBytesOf(value) <= METADATA_LIMITS.jsonBytes || value.textRuns.length === 0
    ? value
    : withoutText(value);

export const buildMetadata = (parts: MetadataParts): ImportedDesignMetadata | null => {
  try {
    const parsed = importedDesignMetadataSchema.safeParse(fitJsonCap(assemble(parts)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const parseImportedDesignMetadata = (
  value: unknown,
): Result<{ metadata: ImportedDesignMetadata }> => {
  const parsed = importedDesignMetadataSchema.safeParse(value);
  return parsed.success
    ? { ok: true, metadata: parsed.data }
    : invalid(DESIGN_IMPORT_MESSAGE.readFailed);
};

export const metadataTruncatedCount = (metadata: ImportedDesignMetadata): number =>
  [
    metadata.truncation.layers,
    metadata.truncation.textRuns,
    metadata.truncation.fonts,
    metadata.truncation.colors,
  ].filter(Boolean).length;

export const metadataNotes = (metadata: ImportedDesignMetadata | null): ImportNote[] => {
  const count = metadata === null ? 0 : metadataTruncatedCount(metadata);
  return count > 0 ? [{ kind: DesignImportNoteKind.MetadataTruncated, count }] : [];
};

export const withMetadataNotes = (result: Result<ImportKindResult>): Result<ImportKindResult> => {
  if (!result.ok) return result;
  const extra = metadataNotes(result.design.metadata);
  if (extra.length === 0) return result;
  return { ...result, design: { ...result.design, notes: [...result.design.notes, ...extra] } };
};
