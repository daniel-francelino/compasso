import type { ValueOf } from "@/lib/shared/utils";
import type { Result } from "@/lib/shared/server-utils";
import type { DesignElement } from "@/lib/shared/design/schemas";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";

export const DesignImportFormat = {
  Psd: "psd",
  Ai: "ai",
  Pdf: "pdf",
  Png: "png",
  Jpeg: "jpeg",
  Webp: "webp",
} as const;
export type DesignImportFormat = ValueOf<typeof DesignImportFormat>;

export const DesignImportKind = {
  Document: "document",
  Image: "image",
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
} as const;
export type DesignImportNoteKind = ValueOf<typeof DesignImportNoteKind>;

export type ImportNote = { kind: DesignImportNoteKind; count: number };

export type ImportedDesign = {
  format: DesignImportFormat;
  width: number;
  height: number;
  elements: DesignElement[];
  buffers: Map<string, PixelBuffer>;
  notes: ImportNote[];
};

export type ImportKindResult =
  | { kind: typeof DesignImportKind.Document; design: ImportedDesign }
  | { kind: typeof DesignImportKind.Image; design: ImportedDesign };

export const DesignImportFailure = {
  Corrupt: "corrupt",
  Memory: "memory",
  TooManyLayers: "too_many_layers",
  LayerTooLarge: "layer_too_large",
  NoLayers: "no_layers",
} as const;
export type DesignImportFailure = ValueOf<typeof DesignImportFailure>;

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
    | { runsIn: "main"; decode: (input: ImportInput) => Promise<Result<ImportKindResult>> }
    | { runsIn: "worker"; decode: (input: WorkerImportInput) => Promise<Result<ImportKindResult>> }
  );
