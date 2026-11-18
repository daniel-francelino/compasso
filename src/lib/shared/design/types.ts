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
  Raster: "raster",
  Adjustment: "adjustment",
  Group: "group",
} as const;
export type DesignElementKind = ValueOf<typeof DesignElementKind>;

export const DesignBlendMode = {
  Normal: "normal",
  Multiply: "multiply",
  Screen: "screen",
  Overlay: "overlay",
  Darken: "darken",
  Lighten: "lighten",
  ColorDodge: "color-dodge",
  ColorBurn: "color-burn",
  HardLight: "hard-light",
  SoftLight: "soft-light",
  Difference: "difference",
  Exclusion: "exclusion",
  Hue: "hue",
  Saturation: "saturation",
  Color: "color",
  Luminosity: "luminosity",
} as const;
export type DesignBlendMode = ValueOf<typeof DesignBlendMode>;

export const DESIGN_BLEND_MODE_LABEL: Record<DesignBlendMode, string> = {
  [DesignBlendMode.Normal]: "Normal",
  [DesignBlendMode.Multiply]: "Multiplicar",
  [DesignBlendMode.Screen]: "Tela",
  [DesignBlendMode.Overlay]: "Sobrepor",
  [DesignBlendMode.Darken]: "Escurecer",
  [DesignBlendMode.Lighten]: "Clarear",
  [DesignBlendMode.ColorDodge]: "Subexposição de cores",
  [DesignBlendMode.ColorBurn]: "Superexposição de cores",
  [DesignBlendMode.HardLight]: "Luz direta",
  [DesignBlendMode.SoftLight]: "Luz suave",
  [DesignBlendMode.Difference]: "Diferença",
  [DesignBlendMode.Exclusion]: "Exclusão",
  [DesignBlendMode.Hue]: "Matiz",
  [DesignBlendMode.Saturation]: "Saturação",
  [DesignBlendMode.Color]: "Cor",
  [DesignBlendMode.Luminosity]: "Luminosidade",
};

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

export const DesignTool = {
  Move: "move",
  Text: "text",
  Rect: "rect",
  Ellipse: "ellipse",
  Line: "line",
  Hand: "hand",
  Zoom: "zoom",
  Marquee: "marquee",
  Lasso: "lasso",
  Wand: "wand",
  Crop: "crop",
  Eyedropper: "eyedropper",
  Brush: "brush",
  Clone: "clone",
  Eraser: "eraser",
  Fill: "fill",
} as const;
export type DesignTool = ValueOf<typeof DesignTool>;

export const DesignAlign = {
  Left: "left",
  CenterX: "center_x",
  Right: "right",
  Top: "top",
  CenterY: "center_y",
  Bottom: "bottom",
} as const;
export type DesignAlign = ValueOf<typeof DesignAlign>;

export const DesignDistribute = {
  Horizontal: "horizontal",
  Vertical: "vertical",
} as const;
export type DesignDistribute = ValueOf<typeof DesignDistribute>;

export const DesignPanel = {
  Layers: "layers",
  Properties: "properties",
  Adjustments: "adjustments",
  History: "history",
  Brand: "brand",
} as const;
export type DesignPanel = ValueOf<typeof DesignPanel>;

export const DesignSaveState = {
  Saved: "saved",
  Pending: "pending",
  Saving: "saving",
  Conflict: "conflict",
  Failed: "failed",
  Uploading: "uploading",
  UploadFailed: "upload_failed",
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
  [DesignElementKind.Raster]: "Camada",
  [DesignElementKind.Adjustment]: "Ajuste",
  [DesignElementKind.Group]: "Grupo",
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

export const DESIGN_TOOL_LABEL: Record<DesignTool, string> = {
  [DesignTool.Move]: "Mover",
  [DesignTool.Text]: "Texto",
  [DesignTool.Rect]: "Retângulo",
  [DesignTool.Ellipse]: "Elipse",
  [DesignTool.Line]: "Linha",
  [DesignTool.Hand]: "Mão",
  [DesignTool.Zoom]: "Zoom",
  [DesignTool.Marquee]: "Seleção retangular",
  [DesignTool.Lasso]: "Laço",
  [DesignTool.Wand]: "Varinha mágica",
  [DesignTool.Crop]: "Cortar",
  [DesignTool.Eyedropper]: "Conta-gotas",
  [DesignTool.Brush]: "Pincel",
  [DesignTool.Clone]: "Carimbo",
  [DesignTool.Eraser]: "Borracha",
  [DesignTool.Fill]: "Balde de tinta",
};

export const DESIGN_TOOL_KEY: Record<DesignTool, string> = {
  [DesignTool.Move]: "v",
  [DesignTool.Text]: "t",
  [DesignTool.Rect]: "u",
  [DesignTool.Ellipse]: "u",
  [DesignTool.Line]: "u",
  [DesignTool.Hand]: "h",
  [DesignTool.Zoom]: "z",
  [DesignTool.Marquee]: "m",
  [DesignTool.Lasso]: "l",
  [DesignTool.Wand]: "w",
  [DesignTool.Crop]: "c",
  [DesignTool.Eyedropper]: "i",
  [DesignTool.Brush]: "b",
  [DesignTool.Clone]: "s",
  [DesignTool.Eraser]: "e",
  [DesignTool.Fill]: "g",
};

export const DESIGN_ENABLED_TOOLS: readonly DesignTool[] = [
  DesignTool.Move,
  DesignTool.Text,
  DesignTool.Rect,
  DesignTool.Ellipse,
  DesignTool.Line,
  DesignTool.Hand,
  DesignTool.Zoom,
  DesignTool.Eyedropper,
  DesignTool.Brush,
  DesignTool.Eraser,
];

export const DESIGN_SHAPE_TOOLS: readonly DesignTool[] = [
  DesignTool.Rect,
  DesignTool.Ellipse,
  DesignTool.Line,
];

export const DesignToolGroup = {
  Move: "move",
  Selection: "selection",
  Crop: "crop",
  Eyedropper: "eyedropper",
  Paint: "paint",
  Fill: "fill",
  Text: "text",
  Shapes: "shapes",
  Hand: "hand",
  Zoom: "zoom",
} as const;
export type DesignToolGroup = ValueOf<typeof DesignToolGroup>;

export const DESIGN_TOOL_GROUPS: Record<DesignToolGroup, readonly DesignTool[]> = {
  [DesignToolGroup.Move]: [DesignTool.Move],
  [DesignToolGroup.Selection]: [DesignTool.Marquee, DesignTool.Lasso, DesignTool.Wand],
  [DesignToolGroup.Crop]: [DesignTool.Crop],
  [DesignToolGroup.Eyedropper]: [DesignTool.Eyedropper],
  [DesignToolGroup.Paint]: [DesignTool.Brush, DesignTool.Eraser, DesignTool.Clone],
  [DesignToolGroup.Fill]: [DesignTool.Fill],
  [DesignToolGroup.Text]: [DesignTool.Text],
  [DesignToolGroup.Shapes]: [DesignTool.Rect, DesignTool.Ellipse, DesignTool.Line],
  [DesignToolGroup.Hand]: [DesignTool.Hand],
  [DesignToolGroup.Zoom]: [DesignTool.Zoom],
};

export type VisibleToolGroup = { group: DesignToolGroup; tools: readonly DesignTool[] };

export const visibleToolGroups = (enabled: readonly DesignTool[]): VisibleToolGroup[] =>
  Object.values(DesignToolGroup)
    .map((group) => ({
      group,
      tools: DESIGN_TOOL_GROUPS[group].filter((tool) => enabled.includes(tool)),
    }))
    .filter((item) => item.tools.length > 0);

export const DESIGN_SHAPE_KEY = "u";

export const DESIGN_IMAGE_KEY = "k";
export const DESIGN_IMAGE_SHORTCUT_LABEL = "Ctrl+Shift+K";

export const DESIGN_DUPLICATE_KEY = "j";

export const isEnabledTool = (tool: DesignTool): boolean => DESIGN_ENABLED_TOOLS.includes(tool);

export const isShapeTool = (tool: DesignTool): boolean => DESIGN_SHAPE_TOOLS.includes(tool);

export const nextShapeTool = (tool: DesignTool): DesignTool => {
  const index = DESIGN_SHAPE_TOOLS.indexOf(tool);
  return DESIGN_SHAPE_TOOLS[(index + 1) % DESIGN_SHAPE_TOOLS.length] ?? DesignTool.Rect;
};

const toolKeys = (tools: readonly DesignTool[]): string =>
  tools.map((tool) => DESIGN_TOOL_KEY[tool].toUpperCase()).join(" · ");

export const DESIGN_SHORTCUT_HELP: readonly (readonly [string, string])[] = [
  [
    toolKeys(DESIGN_ENABLED_TOOLS.filter((tool) => !isShapeTool(tool))),
    "Mover, texto, mão, zoom, conta-gotas, pincel, borracha",
  ],
  [
    `${DESIGN_SHAPE_KEY.toUpperCase()} / Shift + ${DESIGN_SHAPE_KEY.toUpperCase()}`,
    "Formas: última usada / alternar",
  ],
  [DESIGN_IMAGE_SHORTCUT_LABEL, "Inserir imagem"],
  ["X / D", "Trocar as cores de frente e de fundo / cores padrão"],
  ["[ / ]", "Pincel e borracha: diminuir / aumentar o tamanho"],
  ["{ / } (Shift + [ / ])", "Pincel e borracha: diminuir / aumentar a dureza"],
  ["1 a 9, 0", "Pincel e borracha: opacidade de 10% a 100%"],
  ["Espaço + arrastar", "Mover a visualização"],
  ["Ctrl + roda", "Zoom no cursor"],
  ["Ctrl + 0 / Ctrl + 1", "Ajustar à tela / 100%"],
  ["Ctrl + = / Ctrl + -", "Aumentar / diminuir zoom"],
  ["Setas (Shift: 10 px)", "Mover a seleção"],
  ["Ctrl + A", "Selecionar tudo"],
  [`Ctrl + ${DESIGN_DUPLICATE_KEY.toUpperCase()} / Ctrl + D`, "Duplicar"],
  ["Ctrl + G / Ctrl + Shift + G", "Agrupar / desagrupar"],
  ["Ctrl + Z / Ctrl + Shift + Z", "Desfazer / refazer"],
  ["Delete", "Excluir"],
  ["Duplo clique no texto", "Editar o texto na página"],
  ["Esc", "Voltar para Mover / limpar a seleção"],
];

export const DESIGN_ALIGN_ACTION_LABEL: Record<DesignAlign, string> = {
  [DesignAlign.Left]: "Alinhar à esquerda",
  [DesignAlign.CenterX]: "Centralizar na horizontal",
  [DesignAlign.Right]: "Alinhar à direita",
  [DesignAlign.Top]: "Alinhar ao topo",
  [DesignAlign.CenterY]: "Centralizar na vertical",
  [DesignAlign.Bottom]: "Alinhar à base",
};

export const DESIGN_DISTRIBUTE_LABEL: Record<DesignDistribute, string> = {
  [DesignDistribute.Horizontal]: "Distribuir na horizontal",
  [DesignDistribute.Vertical]: "Distribuir na vertical",
};

export const DESIGN_PANEL_LABEL: Record<DesignPanel, string> = {
  [DesignPanel.Layers]: "Camadas",
  [DesignPanel.Properties]: "Propriedades",
  [DesignPanel.Adjustments]: "Ajustes",
  [DesignPanel.History]: "Histórico",
  [DesignPanel.Brand]: "Marca",
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
  maxElementsV2: 100,
  maxElements: 200,
  minPageSide: 64,
  maxPageSide: 4096,
  maxRasterSide: 4096,
  maxGroupDepth: 8,
  rasterBudgetBytes: 512 * 1024 * 1024,
  maxBytes: 262144,
  maxText: 2000,
  maxAlt: 300,
  layerNameMax: 80,
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
  pixelFlushMs: 60000,
  pixelFlushMinGapMs: 15000,
  nudge: 1,
  nudgeLarge: 10,
  duplicateOffset: 24,
  snapScreenPx: 6,
  jpegQuality: 0.92,
  minViewZoom: 0.1,
  maxViewZoom: 8,
  wheelZoomSpeed: 0.0015,
  viewPadding: 48,
  drawMinScreenPx: 6,
  rulerSize: 24,
  rulerMinStepPx: 60,
} as const;

export const DESIGN_PAGE_SIZE = 20;
