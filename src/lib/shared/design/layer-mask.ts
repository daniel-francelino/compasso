import type { CoverageMask } from "@/lib/shared/design/raster/blend";
import { createPixelBuffer, type PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import type { SelectionMask } from "@/lib/shared/design/raster/selection";
import { rasterizedPixelSize } from "@/lib/shared/design/rasterize";
import type {
  AdjustmentElement,
  DesignElement,
  LayerMask,
  RasterElement,
} from "@/lib/shared/design/schemas";
import { DesignElementKind } from "@/lib/shared/design/types";
import type { ValueOf } from "@/lib/shared/utils";

export const LayerMaskKind = {
  RevealAll: "reveal_all",
  HideAll: "hide_all",
  RevealSelection: "reveal_selection",
  HideSelection: "hide_selection",
} as const;
export type LayerMaskKind = ValueOf<typeof LayerMaskKind>;

export const LAYER_MASK_KIND_LABEL: Record<LayerMaskKind, string> = {
  [LayerMaskKind.RevealAll]: "Revelar tudo",
  [LayerMaskKind.HideAll]: "Ocultar tudo",
  [LayerMaskKind.RevealSelection]: "Revelar seleção",
  [LayerMaskKind.HideSelection]: "Ocultar seleção",
};

export const MASK_ADD_LABEL = "Adicionar máscara";
export const MASK_DELETE_LABEL = "Excluir máscara";
export const MASK_DISABLE_LABEL = "Desativar máscara";
export const MASK_ENABLE_LABEL = "Ativar máscara";
export const MASK_PAINT_LABEL = "Máscara de camada";
export const MASK_UNSUPPORTED_REASON = "Selecione uma camada de pixels ou de ajuste.";
export const MASK_EXISTS_REASON = "A camada já tem máscara.";
export const MASK_MISSING_REASON = "A camada não tem máscara.";
export const MASK_NO_SELECTION_REASON = "Não há seleção de pixels.";
export const MASK_MEMORY_MESSAGE =
  "Memória insuficiente para criar a máscara. Exclua camadas ou reduza o tamanho do design e tente de novo.";

const MASK_SUFFIX = ":mask";
const WHITE = { r: 255, g: 255, b: 255, a: 255 } as const;
const BLACK = { r: 0, g: 0, b: 0, a: 255 } as const;
const FULL_COVERAGE = 255;

export type MaskableElement = RasterElement | AdjustmentElement;

export const NEW_LAYER_MASK: LayerMask = { mediaVersionId: null, enabled: true, linked: true };

export const maskKey = (id: string): string => `${id}${MASK_SUFFIX}`;

export const isMaskKey = (key: string): boolean => key.endsWith(MASK_SUFFIX);

export const ownerIdOfKey = (key: string): string =>
  isMaskKey(key) ? key.slice(0, key.length - MASK_SUFFIX.length) : key;

export const isMaskable = (element: DesignElement): element is MaskableElement =>
  element.kind === DesignElementKind.Raster || element.kind === DesignElementKind.Adjustment;

export const isMaskActive = (element: DesignElement): boolean =>
  element.mask !== null && element.mask.enabled;

export const maskPixelSize = (element: MaskableElement): { width: number; height: number } => {
  if (element.kind === DesignElementKind.Raster) {
    return { width: element.pixelWidth, height: element.pixelHeight };
  }
  const size = rasterizedPixelSize(element.width, element.height);
  return { width: size.pixelWidth, height: size.pixelHeight };
};

export const maskPlacement = (element: DesignElement, buffer: PixelBuffer) => ({
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
  rotation: element.rotation,
  pixelWidth: buffer.width,
  pixelHeight: buffer.height,
});

export const grayOf = (color: { r: number; g: number; b: number }): number =>
  Math.round(0.299 * color.r + 0.587 * color.g + 0.114 * color.b);

export const grayColor = (value: number) => ({ r: value, g: value, b: value, a: 255 });

export const buildMaskBuffer = (
  kind: LayerMaskKind,
  width: number,
  height: number,
  selection: SelectionMask | null,
): PixelBuffer => {
  const revealing = kind === LayerMaskKind.RevealAll || kind === LayerMaskKind.RevealSelection;
  const whole = kind === LayerMaskKind.RevealAll || kind === LayerMaskKind.HideAll;
  const buffer = createPixelBuffer(width, height, revealing && whole ? WHITE : BLACK);
  if (whole) return buffer;
  const invert = kind === LayerMaskKind.HideSelection;
  const count = width * height;
  for (let pixel = 0; pixel < count; pixel += 1) {
    const covered = selection === null ? 0 : (selection.data[pixel] ?? 0);
    const value = invert ? FULL_COVERAGE - covered : covered;
    const at = pixel * 4;
    buffer.data[at] = value;
    buffer.data[at + 1] = value;
    buffer.data[at + 2] = value;
  }
  return buffer;
};

export const coverageOfPlaced = (placed: PixelBuffer): CoverageMask => {
  const count = placed.width * placed.height;
  const data = new Uint8Array(count);
  for (let pixel = 0; pixel < count; pixel += 1) {
    const at = pixel * 4;
    data[pixel] = Math.round(((placed.data[at] ?? 0) * (placed.data[at + 3] ?? 0)) / 255);
  }
  return { width: placed.width, height: placed.height, data };
};

export const maskValueAt = (buffer: PixelBuffer, x: number, y: number): number => {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return 0;
  return buffer.data[(y * buffer.width + x) * 4] ?? 0;
};

export const maskSignature = (element: DesignElement, serial: number, revision: number): string =>
  isMaskActive(element) ? `m${serial}:${revision}` : "m-";

export type MaskPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  pixelWidth: number;
  pixelHeight: number;
};

export type PaintTarget = { key: string; placement: MaskPlacement; mask: boolean };

export const maskCreateReason = (
  element: DesignElement | undefined,
  kind: LayerMaskKind,
  hasSelection: boolean,
): string | undefined => {
  if (element === undefined || !isMaskable(element)) return MASK_UNSUPPORTED_REASON;
  if (element.mask !== null) return MASK_EXISTS_REASON;
  const bySelection =
    kind === LayerMaskKind.RevealSelection || kind === LayerMaskKind.HideSelection;
  return bySelection && !hasSelection ? MASK_NO_SELECTION_REASON : undefined;
};
