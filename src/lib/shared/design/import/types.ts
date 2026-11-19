import type { ValueOf } from "@/lib/shared/utils";
import type { Result } from "@/lib/shared/server-utils";
import type { DesignElement } from "@/lib/shared/design/schemas";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import type { ImportedDesignMetadata } from "@/lib/shared/design/import/metadata";

export const DesignImportFormat = {
  Psd: "psd",
  Ai: "ai",
  Pdf: "pdf",
  Png: "png",
  Jpeg: "jpeg",
  Webp: "webp",
  Tiff: "tiff",
  Avif: "avif",
  Gif: "gif",
  Ase: "ase",
  Aco: "aco",
  Gpl: "gpl",
  Svg: "svg",
  Sketch: "sketch",
} as const;
export type DesignImportFormat = ValueOf<typeof DesignImportFormat>;

export const DesignImportKind = {
  Document: "document",
  Image: "image",
  Palette: "palette",
} as const;
export type DesignImportKind = ValueOf<typeof DesignImportKind>;

export const DesignImportNoteKind = {
  TextAsPixels: "text_as_pixels",
  SmartObjectAsPixels: "smart_object_as_pixels",
  LayerStyleDropped: "layer_style_dropped",
  AdjustmentLayerDropped: "adjustment_layer_dropped",
  BlendModeFallback: "blend_mode_fallback",
  ClippingPartial: "clipping_partial",
  GroupsFlattened: "groups_flattened",
  FlattenedImageOnly: "flattened_image_only",
  CmykConverted: "cmyk_converted",
  DepthReduced: "depth_reduced",
  FirstPageOnly: "first_page_only",
  Downscaled: "downscaled",
  AnimationIgnored: "animation_ignored",
  MetadataTruncated: "metadata_truncated",
  VectorRasterized: "vector_rasterized",
  FontsNotImported: "fonts_not_imported",
  UnsupportedNode: "unsupported_node",
  SwatchConverted: "swatch_converted",
} as const;
export type DesignImportNoteKind = ValueOf<typeof DesignImportNoteKind>;

export const DesignImportColorMode = {
  Grayscale: "grayscale",
  Rgb: "rgb",
  Cmyk: "cmyk",
  Indexed: "indexed",
  Bitmap: "bitmap",
  Unknown: "unknown",
} as const;
export type DesignImportColorMode = ValueOf<typeof DesignImportColorMode>;

export type ImportNote = { kind: DesignImportNoteKind; count: number };

export type ImportedDesign = {
  format: DesignImportFormat;
  width: number;
  height: number;
  elements: DesignElement[];
  buffers: Map<string, PixelBuffer>;
  notes: ImportNote[];
  metadata: ImportedDesignMetadata | null;
};

export type ImportKindResult =
  | { kind: typeof DesignImportKind.Document; design: ImportedDesign }
  | { kind: typeof DesignImportKind.Image; design: ImportedDesign };

export const IMPORT_NEEDS_CHOICE = "needs_choice";

export type ImportSwatch = { name: string; hex: string; converted: boolean };

export type ImportPalette = { swatches: ImportSwatch[]; notes: ImportNote[] };

export type ImportChoiceOption = { id: string; label: string; detail?: string | undefined };

export type ImportChoice = {
  title: string;
  confirmLabel: string;
  options: readonly ImportChoiceOption[];
};

export type ImportOutcome =
  | ImportKindResult
  | { kind: typeof DesignImportKind.Palette; palette: ImportPalette }
  | {
      kind: typeof IMPORT_NEEDS_CHOICE;
      choice: ImportChoice;
      resume: (
        optionId: string,
        signal?: AbortSignal | undefined,
      ) => Promise<Result<ImportOutcome>>;
    };

export const DesignImportFailure = {
  Corrupt: "corrupt",
  Memory: "memory",
  TooManyLayers: "too_many_layers",
  LayerTooLarge: "layer_too_large",
  NoLayers: "no_layers",
  ImageTooLarge: "image_too_large",
} as const;
export type DesignImportFailure = ValueOf<typeof DesignImportFailure>;

export const SketchRefusal = {
  Corrupt: "corrupt",
  NotZip: "not_zip",
  UnsupportedVersion: "unsupported_version",
  NoArtboards: "no_artboards",
  NoLayers: "no_layers",
  Memory: "memory",
  LayerTooLarge: "layer_too_large",
  TimedOut: "timed_out",
  ReadFailed: "read_failed",
  Encrypted: "encrypted",
  ZipEntries: "zip_entries",
  ZipTooLarge: "zip_too_large",
  ZipRatio: "zip_ratio",
  ZipPath: "zip_path",
  CanvasTooLarge: "canvas_too_large",
  CanvasTooSmall: "canvas_too_small",
  TooManyLayers: "too_many_layers",
  ImageTooLarge: "image_too_large",
} as const;
export type SketchRefusal = ValueOf<typeof SketchRefusal>;

export type ImportContext = {
  capacityElements: number;
  usedBytes: number;
  signal?: AbortSignal | undefined;
};

export type WorkerImportInput = ImportContext & {
  file: File;
  newId: () => string;
};

export type ImportInput = WorkerImportInput & { bytes: Uint8Array };

type HandlerBase = {
  format: DesignImportFormat;
  kind: DesignImportKind;
  extensions: readonly string[];
  maxBytes: number;
  sniff: (head: Uint8Array) => boolean;
};

export type ImportHandler = HandlerBase &
  (
    | {
        runsIn: "main";
        headBytes?: number;
        decode: (input: ImportInput) => Promise<Result<ImportOutcome>>;
      }
    | { runsIn: "worker"; decode: (input: WorkerImportInput) => Promise<Result<ImportOutcome>> }
  );
