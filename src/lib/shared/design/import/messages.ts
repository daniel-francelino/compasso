import { type Failure, invalid } from "@/lib/shared/server-utils";
import {
  DesignImportFormat,
  DesignImportNoteKind,
  type ImportNote,
} from "@/lib/shared/design/import/types";

const BYTES_PER_MIB = 1024 * 1024;

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export const DESIGN_IMPORT_FORMAT_LABEL: Record<DesignImportFormat, string> = {
  [DesignImportFormat.Psd]: "PSD",
  [DesignImportFormat.Ai]: "AI",
  [DesignImportFormat.Pdf]: "PDF",
  [DesignImportFormat.Png]: "PNG",
  [DesignImportFormat.Jpeg]: "JPEG",
  [DesignImportFormat.Webp]: "WebP",
};

export const DESIGN_IMPORT_LABEL = "Importar…";
export const DESIGN_IMPORT_PROGRESS = "Importando arquivo…";
export const DESIGN_IMPORT_CANCEL_LABEL = "Cancelar importação";
export const designImportDone = (format: DesignImportFormat): string =>
  `${DESIGN_IMPORT_FORMAT_LABEL[format]} importado.`;
export const designImportHistoryLabel = (format: DesignImportFormat): string =>
  `Importar ${DESIGN_IMPORT_FORMAT_LABEL[format]}`;
export const IMPORT_UPLOAD_REASON =
  "Importar exige permissão para enviar arquivos à biblioteca de mídia.";

export const DESIGN_IMPORT_LAYER_NAME = {
  image: "Imagem",
  art: "Arte",
  layer: "Camada",
  group: "Grupo",
} as const;

export const DESIGN_IMPORT_MESSAGE = {
  tooLarge: (limitBytes: number): string =>
    `O arquivo passa de ${Math.floor(limitBytes / BYTES_PER_MIB)} MB. Exporte uma versão menor e tente de novo.`,
  empty: "O arquivo está vazio.",
  unsupportedType: (formats: string): string => `Envie um arquivo ${formats}.`,
  nameMismatch: "O conteúdo do arquivo não corresponde à extensão. Confira o arquivo.",
  psb: "Arquivos PSB (documento grande) não são aceitos. Salve como PSD.",
  corrupt: "Não foi possível ler o arquivo. Ele pode estar corrompido.",
  imageCorrupt: "Não foi possível ler a imagem. Ela pode estar corrompida.",
  imageTooLarge: (width: number, height: number): string =>
    `A imagem é grande demais para abrir (${width} × ${height} px).`,
  psdColorMode:
    "O modo de cor deste PSD não é aceito. Converta para RGB, CMYK, tons de cinza ou indexado.",
  canvasTooLarge: (maxSide: number): string =>
    `A tela do arquivo passa de ${maxSide} px em um dos lados. Reduza o tamanho e tente de novo.`,
  canvasTooSmall: (minSide: number): string =>
    `A tela do arquivo é menor que ${minSide} px. Use um arquivo maior.`,
  aiNotPdf:
    "Este arquivo .ai foi salvo sem compatibilidade com PDF. No Illustrator, salve de novo marcando “Criar arquivo compatível com PDF”.",
  encrypted: "O arquivo tem senha. Salve uma cópia sem senha e tente de novo.",
  aiRender: "Não foi possível desenhar este arquivo .ai. Exporte como PNG ou PSD e tente de novo.",
  noLayers: "O arquivo não tem camadas visíveis.",
  tooManyLayers: (limit: number): string =>
    `O arquivo tem camadas demais para esta página (limite ${limit}).`,
  memory: "Não há memória livre para este arquivo. Remova camadas de pixels e tente de novo.",
  readFailed: "Não foi possível ler o arquivo.",
  layerTooLarge: "Uma camada do arquivo é grande demais para importar.",
  timedOut: "A leitura do arquivo demorou demais e foi interrompida.",
  cancelled: "Importação cancelada.",
} as const;

export const DESIGN_IMPORT_NOTE_SENTENCE: Record<DesignImportNoteKind, (count: number) => string> =
  {
    [DesignImportNoteKind.TextAsPixels]: (count) =>
      `Texto convertido em pixels (${plural(count, "camada", "camadas")}).`,
    [DesignImportNoteKind.SmartObjectAsPixels]: (count) =>
      `Objetos inteligentes convertidos em pixels (${count}).`,
    [DesignImportNoteKind.LayerStyleDropped]: (count) => `Estilos de camada ignorados (${count}).`,
    [DesignImportNoteKind.AdjustmentLayerDropped]: (count) =>
      `Camadas de ajuste ignoradas (${count}).`,
    [DesignImportNoteKind.BlendModeFallback]: (count) =>
      `Modos de mesclagem sem equivalente (${plural(count, "camada", "camadas")}).`,
    [DesignImportNoteKind.ClippingPartial]: (count) =>
      `Máscaras de corte aplicadas só em parte (${count}).`,
    [DesignImportNoteKind.GroupsFlattened]: (count) =>
      `Grupos muito profundos foram achatados (${count}).`,
    [DesignImportNoteKind.FlattenedImageOnly]: () =>
      "O arquivo só tinha a imagem final, sem camadas.",
    [DesignImportNoteKind.CmykConverted]: () => "Cores CMYK convertidas para RGB.",
    [DesignImportNoteKind.DepthReduced]: () => "Profundidade de cor reduzida para 8 bits.",
    [DesignImportNoteKind.FirstPageOnly]: () => "Só a primeira página foi importada.",
    [DesignImportNoteKind.Downscaled]: (count) =>
      `Imagem reduzida para caber na página (${count}).`,
    [DesignImportNoteKind.AnimationIgnored]: () =>
      "Animação ignorada: só o primeiro quadro foi importado.",
    [DesignImportNoteKind.MetadataTruncated]: (count) =>
      `Metadados do arquivo registrados só em parte (${plural(count, "lista", "listas")}).`,
  };

export const IMPORT_CANCELLED: Failure = invalid(DESIGN_IMPORT_MESSAGE.cancelled);

export const isImportCancelled = (failure: Failure): boolean => failure === IMPORT_CANCELLED;

export const describeImportNotes = (notes: readonly ImportNote[]): string =>
  notes.map((note) => DESIGN_IMPORT_NOTE_SENTENCE[note.kind](note.count)).join(" ");
