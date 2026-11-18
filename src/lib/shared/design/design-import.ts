import type { ValueOf } from "@/lib/shared/utils";
import { type Result, invalid } from "@/lib/shared/server-utils";
import type { DesignElement } from "@/lib/shared/design/schemas";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";

export const DesignImportFormat = {
  Psd: "psd",
  Ai: "ai",
} as const;
export type DesignImportFormat = ValueOf<typeof DesignImportFormat>;

export const DESIGN_IMPORT_FORMAT_LABEL: Record<DesignImportFormat, string> = {
  [DesignImportFormat.Psd]: "PSD",
  [DesignImportFormat.Ai]: "AI",
};

export const DESIGN_IMPORT_ACCEPT = ".psd,.ai";

export const DESIGN_IMPORT_LIMITS = {
  maxBytes: 100 * 1024 * 1024,
  maxPageSide: 4096,
  minPageSide: 64,
  aiTargetScale: 2,
  aiMaxImagePixels: 16_777_216,
  psdMemoryBytes: 768 * 1024 * 1024,
} as const;

export const DESIGN_IMPORT_MESSAGE = {
  tooLarge: "O arquivo passa de 100 MB. Exporte uma versão menor e tente de novo.",
  empty: "O arquivo está vazio.",
  unsupportedType: "Envie um arquivo .psd (Photoshop) ou .ai (Illustrator).",
  nameMismatch: "O conteúdo do arquivo não corresponde à extensão. Confira o arquivo.",
  psb: "Arquivos PSB (documento grande) não são aceitos. Salve como .psd.",
  psdCorrupt: "Não foi possível ler este PSD. O arquivo pode estar corrompido.",
  psdColorMode:
    "Este PSD usa um modo de cor sem suporte (multicanal, duotone ou Lab). Converta para RGB.",
  canvasTooLarge:
    "A tela do arquivo passa de 4096 px em um dos lados. Reduza o tamanho e tente de novo.",
  canvasTooSmall: "A tela do arquivo é menor que 64 px em um dos lados.",
  aiNotPdf:
    "Este arquivo .ai foi salvo sem compatibilidade com PDF. No Illustrator, salve de novo marcando “Criar arquivo compatível com PDF”.",
  aiCorrupt: "Não foi possível ler este arquivo .ai. Ele pode estar corrompido.",
  aiEncrypted: "Este arquivo está protegido por senha e não pode ser importado.",
  aiRender: "Não foi possível desenhar este arquivo .ai. Exporte como PNG ou PSD e tente de novo.",
  noLayers: "O arquivo não tem nenhuma camada com pixels visíveis para importar.",
  tooManyLayers:
    "O arquivo tem mais camadas do que cabem neste design. Mescle ou remova camadas e tente de novo.",
  memory:
    "O arquivo não cabe na memória do editor. Reduza o tamanho ou o número de camadas e tente de novo.",
  readFailed: "Não foi possível ler o arquivo.",
} as const;

export const DESIGN_IMPORT_LABEL = "Importar PSD ou AI…";
export const IMPORT_UPLOAD_REASON =
  "Importar exige permissão para enviar arquivos à biblioteca de mídia.";

export type ImportedDesign = {
  format: DesignImportFormat;
  width: number;
  height: number;
  elements: DesignElement[];
  buffers: Map<string, PixelBuffer>;
  notes: string[];
};

const startsWith = (bytes: Uint8Array, text: string, offset = 0): boolean => {
  if (bytes.length < offset + text.length) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
};

const PDF_SEARCH_WINDOW = 1024;

const hasPdfHeaderNear = (bytes: Uint8Array): boolean => {
  const limit = Math.min(bytes.length, PDF_SEARCH_WINDOW);
  for (let offset = 0; offset < limit; offset += 1) {
    if (startsWith(bytes, "%PDF-", offset)) return true;
  }
  return false;
};

export const detectImportFormat = (bytes: Uint8Array): DesignImportFormat | null => {
  if (startsWith(bytes, "8BPS")) return DesignImportFormat.Psd;
  if (hasPdfHeaderNear(bytes) || startsWith(bytes, "%!PS-Adobe")) return DesignImportFormat.Ai;
  return null;
};

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
};

export const importBaseName = (name: string): string => {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.trim();
};

export const inspectImportFile = (
  name: string,
  bytes: Uint8Array,
): Result<{ format: DesignImportFormat }> => {
  if (bytes.length === 0) return invalid(DESIGN_IMPORT_MESSAGE.empty);
  if (bytes.length > DESIGN_IMPORT_LIMITS.maxBytes) return invalid(DESIGN_IMPORT_MESSAGE.tooLarge);
  const format = detectImportFormat(bytes);
  if (format === null) return invalid(DESIGN_IMPORT_MESSAGE.unsupportedType);
  if (extensionOf(name) !== format) return invalid(DESIGN_IMPORT_MESSAGE.nameMismatch);
  return { ok: true, format };
};

export const sizeFitsPage = (width: number, height: number): Result<object> => {
  const { maxPageSide, minPageSide } = DESIGN_IMPORT_LIMITS;
  if (width > maxPageSide || height > maxPageSide) {
    return invalid(DESIGN_IMPORT_MESSAGE.canvasTooLarge);
  }
  if (width < minPageSide || height < minPageSide) {
    return invalid(DESIGN_IMPORT_MESSAGE.canvasTooSmall);
  }
  return { ok: true };
};
