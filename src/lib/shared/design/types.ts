import type { ValueOf } from "@/lib/shared/utils";

export const DesignPreset = {
  FeedSquare: "feed_square",
  FeedPortrait: "feed_portrait",
  Story: "story",
} as const;
export type DesignPreset = ValueOf<typeof DesignPreset>;

export const DesignElementKind = {
  Text: "text",
  Image: "image",
  Rect: "rect",
  Ellipse: "ellipse",
  Line: "line",
} as const;
export type DesignElementKind = ValueOf<typeof DesignElementKind>;

export const DesignFont = {
  DmSans: "dm_sans",
  Cormorant: "cormorant",
  Montserrat: "montserrat",
  PlayfairDisplay: "playfair_display",
  Poppins: "poppins",
  Lora: "lora",
  BebasNeue: "bebas_neue",
  Inter: "inter",
} as const;
export type DesignFont = ValueOf<typeof DesignFont>;

export const DesignTextAlign = {
  Left: "left",
  Center: "center",
  Right: "right",
} as const;
export type DesignTextAlign = ValueOf<typeof DesignTextAlign>;

export const DesignStatusFilter = {
  Active: "active",
  Templates: "templates",
  Trash: "trash",
} as const;
export type DesignStatusFilter = ValueOf<typeof DesignStatusFilter>;

export const DesignExportFormat = {
  Png: "png",
  Jpeg: "jpeg",
} as const;
export type DesignExportFormat = ValueOf<typeof DesignExportFormat>;

export const LayerMove = {
  Up: "up",
  Down: "down",
  Top: "top",
  Bottom: "bottom",
} as const;
export type LayerMove = ValueOf<typeof LayerMove>;

export const DesignSaveState = {
  Saved: "saved",
  Pending: "pending",
  Saving: "saving",
  Conflict: "conflict",
  Failed: "failed",
} as const;
export type DesignSaveState = ValueOf<typeof DesignSaveState>;

export type PageSize = { width: number; height: number };

export const DESIGN_PRESET_SIZE: Record<DesignPreset, PageSize> = {
  [DesignPreset.FeedSquare]: { width: 1080, height: 1080 },
  [DesignPreset.FeedPortrait]: { width: 1080, height: 1350 },
  [DesignPreset.Story]: { width: 1080, height: 1920 },
};

export const DESIGN_PRESET_LABEL: Record<DesignPreset, string> = {
  [DesignPreset.FeedSquare]: "Feed quadrado (1080 × 1080)",
  [DesignPreset.FeedPortrait]: "Feed retrato (1080 × 1350)",
  [DesignPreset.Story]: "Story ou Reel (1080 × 1920)",
};

export const DESIGN_PRESET_SHORT_LABEL: Record<DesignPreset, string> = {
  [DesignPreset.FeedSquare]: "Feed 1:1",
  [DesignPreset.FeedPortrait]: "Feed 4:5",
  [DesignPreset.Story]: "Story 9:16",
};

export const DESIGN_ELEMENT_LABEL: Record<DesignElementKind, string> = {
  [DesignElementKind.Text]: "Texto",
  [DesignElementKind.Image]: "Imagem",
  [DesignElementKind.Rect]: "Retângulo",
  [DesignElementKind.Ellipse]: "Elipse",
  [DesignElementKind.Line]: "Linha",
};

export const DESIGN_FONT_LABEL: Record<DesignFont, string> = {
  [DesignFont.DmSans]: "DM Sans",
  [DesignFont.Cormorant]: "Cormorant Garamond",
  [DesignFont.Montserrat]: "Montserrat",
  [DesignFont.PlayfairDisplay]: "Playfair Display",
  [DesignFont.Poppins]: "Poppins",
  [DesignFont.Lora]: "Lora",
  [DesignFont.BebasNeue]: "Bebas Neue",
  [DesignFont.Inter]: "Inter",
};

export const designFontFamily = (font: DesignFont): string => `Design ${DESIGN_FONT_LABEL[font]}`;

export const DESIGN_ALIGN_LABEL: Record<DesignTextAlign, string> = {
  [DesignTextAlign.Left]: "À esquerda",
  [DesignTextAlign.Center]: "Centralizado",
  [DesignTextAlign.Right]: "À direita",
};

export const DESIGN_EXPORT_FORMAT_LABEL: Record<DesignExportFormat, string> = {
  [DesignExportFormat.Png]: "PNG",
  [DesignExportFormat.Jpeg]: "JPEG",
};

export const DESIGN_EXPORT_MIME: Record<DesignExportFormat, string> = {
  [DesignExportFormat.Png]: "image/png",
  [DesignExportFormat.Jpeg]: "image/jpeg",
};

export const DESIGN_LIMITS = {
  nameMax: 120,
  maxPages: 10,
  maxElements: 100,
  maxBytes: 262144,
  maxText: 2000,
  maxAlt: 300,
  minFontSize: 8,
  maxFontSize: 400,
  minLineHeight: 0.8,
  maxLineHeight: 3,
  maxCoordinate: 20000,
  maxSize: 20000,
  minSize: 1,
  maxCornerRadius: 2000,
  minZoom: 1,
  maxZoom: 5,
  maxBrightness: 0.5,
  maxContrast: 50,
  maxShadowBlur: 100,
  maxShadowOffset: 200,
  minStroke: 1,
  maxStroke: 100,
  history: 100,
  autosaveMs: 2000,
  nudge: 1,
  nudgeLarge: 10,
  duplicateOffset: 24,
  snapScreenPx: 6,
  jpegQuality: 0.92,
} as const;

export const DESIGN_PAGE_SIZE = 20;
