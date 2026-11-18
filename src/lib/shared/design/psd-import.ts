import type { BlendMode, Layer, LayerMaskData, PixelData, Psd } from "ag-psd";
import {
  DESIGN_IMPORT_LIMITS,
  DESIGN_IMPORT_MESSAGE,
  DesignImportFormat,
  type ImportedDesign,
  sizeFitsPage,
} from "@/lib/shared/design/design-import";
import { createRasterLayer, emptyPage } from "@/lib/shared/design/document";
import { logError } from "@/lib/shared/logger";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import { clampByte } from "@/lib/shared/design/raster/numeric";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import type { DesignElement, GroupElement, RasterElement } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignBlendMode, DesignElementKind } from "@/lib/shared/design/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const PSD_HEADER_BYTES = 26;
const PSD_VERSION_OFFSET = 4;
const PSD_HEIGHT_OFFSET = 14;
const PSD_WIDTH_OFFSET = 18;
const PSD_DEPTH_OFFSET = 22;
const PSD_COLOR_MODE_OFFSET = 24;
const PSD_VERSION_PSD = 1;
const COLOR_MODE_CMYK = 4;
const COLOR_MODE_RGB = 3;
const SUPPORTED_COLOR_MODES = [0, 1, 2, COLOR_MODE_RGB, COLOR_MODE_CMYK];

export type PsdHeader = {
  width: number;
  height: number;
  depth: number;
  colorMode: number;
};

export const readPsdHeader = (bytes: Uint8Array): Result<{ header: PsdHeader }> => {
  if (bytes.length < PSD_HEADER_BYTES) return invalid(DESIGN_IMPORT_MESSAGE.psdCorrupt);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(PSD_VERSION_OFFSET) !== PSD_VERSION_PSD) {
    return invalid(DESIGN_IMPORT_MESSAGE.psb);
  }
  const header = {
    height: view.getUint32(PSD_HEIGHT_OFFSET),
    width: view.getUint32(PSD_WIDTH_OFFSET),
    depth: view.getUint16(PSD_DEPTH_OFFSET),
    colorMode: view.getUint16(PSD_COLOR_MODE_OFFSET),
  };
  if (!SUPPORTED_COLOR_MODES.includes(header.colorMode)) {
    return invalid(DESIGN_IMPORT_MESSAGE.psdColorMode);
  }
  const fits = sizeFitsPage(header.width, header.height);
  return fits.ok ? { ok: true, header } : fits;
};

const BLEND_MODES: Partial<Record<BlendMode, DesignBlendMode>> = {
  normal: DesignBlendMode.Normal,
  "pass through": DesignBlendMode.Normal,
  darken: DesignBlendMode.Darken,
  multiply: DesignBlendMode.Multiply,
  "color burn": DesignBlendMode.ColorBurn,
  lighten: DesignBlendMode.Lighten,
  screen: DesignBlendMode.Screen,
  "color dodge": DesignBlendMode.ColorDodge,
  overlay: DesignBlendMode.Overlay,
  "soft light": DesignBlendMode.SoftLight,
  "hard light": DesignBlendMode.HardLight,
  difference: DesignBlendMode.Difference,
  exclusion: DesignBlendMode.Exclusion,
  hue: DesignBlendMode.Hue,
  saturation: DesignBlendMode.Saturation,
  color: DesignBlendMode.Color,
  luminosity: DesignBlendMode.Luminosity,
};

type Counters = {
  text: number;
  smartObjects: number;
  effects: number;
  adjustments: number;
  blendModes: number;
  empty: number;
  masks: number;
  clips: number;
  flattenedGroups: number;
};

type Context = {
  width: number;
  height: number;
  newId: () => string;
  budgetBytes: number;
  usedBytes: number;
  buffers: Map<string, PixelBuffer>;
  counters: Counters;
};

const newCounters = (): Counters => ({
  text: 0,
  smartObjects: 0,
  effects: 0,
  adjustments: 0,
  blendModes: 0,
  empty: 0,
  masks: 0,
  clips: 0,
  flattenedGroups: 0,
});

class MemoryLimitError extends Error {}

const MAX_GROUP_PARENT_LEVEL = DESIGN_LIMITS.maxGroupDepth - 1;

const rgbaOf = (pixels: PixelData): Uint8ClampedArray | null => {
  const expected = pixels.width * pixels.height * 4;
  const { data } = pixels;
  if (data.length !== expected) return null;
  if (data instanceof Uint8ClampedArray) return data;
  if (data instanceof Uint8Array) {
    return new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  }
  if (data instanceof Uint16Array) return Uint8ClampedArray.from(data, (value) => value >> 8);
  return Uint8ClampedArray.from(data, (value) => clampByte(value * 255));
};

type Box = { left: number; top: number; width: number; height: number };

const cropToPage = (
  source: PixelData,
  layer: { left: number; top: number },
  page: { width: number; height: number },
): { buffer: PixelBuffer; box: Box } | null => {
  const rgba = rgbaOf(source);
  if (rgba === null) return null;
  const left = Math.max(0, layer.left);
  const top = Math.max(0, layer.top);
  const right = Math.min(page.width, layer.left + source.width);
  const bottom = Math.min(page.height, layer.top + source.height);
  const width = right - left;
  const height = bottom - top;
  if (width < 1 || height < 1) return null;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const from = ((top - layer.top + row) * source.width + (left - layer.left)) * 4;
    data.set(rgba.subarray(from, from + width * 4), row * width * 4);
  }
  return { buffer: { width, height, data }, box: { left, top, width, height } };
};

const hasVisiblePixels = (buffer: PixelBuffer): boolean => {
  for (let index = 3; index < buffer.data.length; index += 4) {
    if ((buffer.data[index] ?? 0) > 0) return true;
  }
  return false;
};

const maskValueAt = (
  mask: LayerMaskData,
  gray: Uint8ClampedArray | null,
  x: number,
  y: number,
): number => {
  const fallback = mask.defaultColor ?? 255;
  const source = mask.imageData;
  if (gray === null || source === undefined) return fallback;
  const column = x - (mask.left ?? 0);
  const row = y - (mask.top ?? 0);
  const inside = column >= 0 && row >= 0 && column < source.width && row < source.height;
  return inside ? (gray[(row * source.width + column) * 4] ?? fallback) : fallback;
};

const bakeMask = (buffer: PixelBuffer, box: Box, mask: LayerMaskData): boolean => {
  if (mask.disabled === true) return false;
  const gray = mask.imageData === undefined ? null : rgbaOf(mask.imageData);
  if (mask.imageData !== undefined && gray === null) return false;
  if (gray === null && (mask.defaultColor ?? 255) === 255) return false;
  for (let row = 0; row < box.height; row += 1) {
    for (let column = 0; column < box.width; column += 1) {
      const value = maskValueAt(mask, gray, box.left + column, box.top + row);
      const index = (row * box.width + column) * 4 + 3;
      buffer.data[index] = Math.round(((buffer.data[index] ?? 0) * value) / 255);
    }
  }
  return true;
};

const layerName = (layer: Layer, fallback: string): string => {
  const name = (layer.name ?? "").trim().slice(0, DESIGN_LIMITS.layerNameMax);
  return name === "" ? fallback : name;
};

const blendOf = (layer: Layer, context: Context): DesignBlendMode => {
  const mode = layer.blendMode ?? "normal";
  const mapped = BLEND_MODES[mode];
  if (mapped === undefined) context.counters.blendModes += 1;
  return mapped ?? DesignBlendMode.Normal;
};

const unit = (value: number | undefined): number => Math.min(1, Math.max(0, value ?? 1));

const noteSpecial = (layer: Layer, context: Context) => {
  if (layer.text !== undefined) context.counters.text += 1;
  if (layer.placedLayer !== undefined) context.counters.smartObjects += 1;
  if (layer.effects !== undefined) context.counters.effects += 1;
};

const rasterOf = (
  layer: Layer,
  parentId: string | null,
  previous: DesignElement | undefined,
  context: Context,
): RasterElement | null => {
  noteSpecial(layer, context);
  if (layer.imageData === undefined) {
    context.counters.empty += 1;
    return null;
  }
  const cropped = cropToPage(
    layer.imageData,
    { left: layer.left ?? 0, top: layer.top ?? 0 },
    context,
  );
  if (cropped === null) {
    context.counters.empty += 1;
    return null;
  }
  const { buffer, box } = cropped;
  if (layer.mask !== undefined && bakeMask(buffer, box, layer.mask)) context.counters.masks += 1;
  if (!hasVisiblePixels(buffer)) {
    context.counters.empty += 1;
    return null;
  }
  const bytes = rasterBytes(buffer.width, buffer.height);
  if (context.usedBytes + bytes > context.budgetBytes) throw new MemoryLimitError();
  context.usedBytes += bytes;
  const id = context.newId();
  context.buffers.set(id, buffer);
  const clipped = layer.clipping === true;
  const canClip = previous?.kind === DesignElementKind.Raster;
  if (clipped && !canClip) context.counters.clips += 1;
  return {
    ...createRasterLayer(id, emptyPage("import"), context),
    x: box.left,
    y: box.top,
    width: box.width,
    height: box.height,
    pixelWidth: box.width,
    pixelHeight: box.height,
    name: layerName(layer, "Camada"),
    hidden: layer.hidden === true,
    opacity: unit(layer.opacity),
    fillOpacity: unit(layer.fillOpacity),
    blendMode: blendOf(layer, context),
    clipToBelow: clipped && canClip,
    parentId,
  };
};

const groupOf = (layer: Layer, parentId: string | null, context: Context): GroupElement => ({
  id: context.newId(),
  kind: DesignElementKind.Group,
  x: 0,
  y: 0,
  width: context.width,
  height: context.height,
  rotation: 0,
  opacity: unit(layer.opacity),
  locked: false,
  groupId: null,
  blendMode: blendOf(layer, context),
  fillOpacity: 1,
  name: layerName(layer, "Grupo"),
  hidden: layer.hidden === true,
  parentId,
  clipToBelow: false,
  mask: null,
  collapsed: layer.opened === false,
  passThrough: (layer.blendMode ?? "pass through") === "pass through",
});

const leafOf = (
  layer: Layer,
  parentId: string | null,
  previous: DesignElement | undefined,
  context: Context,
): DesignElement[] => {
  if (layer.adjustment === undefined) {
    const raster = rasterOf(layer, parentId, previous, context);
    return raster === null ? [] : [raster];
  }
  context.counters.adjustments += 1;
  return [];
};

const emitLayers = (
  layers: readonly Layer[],
  parentId: string | null,
  level: number,
  context: Context,
): DesignElement[] => {
  const emitted: DesignElement[] = [];
  for (const layer of layers) {
    const previous = emitted.at(-1);
    if (layer.children === undefined) {
      emitted.push(...leafOf(layer, parentId, previous, context));
      continue;
    }
    if (level >= MAX_GROUP_PARENT_LEVEL) {
      context.counters.flattenedGroups += 1;
      emitted.push(...emitLayers(layer.children, parentId, level, context));
      continue;
    }
    const group = groupOf(layer, parentId, context);
    const inner = emitLayers(layer.children, group.id, level + 1, context);
    if (inner.length > 0) emitted.push(group, ...inner);
  }
  return emitted;
};

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const notesOf = (counters: Counters, psd: Psd, flattened: boolean): string[] => {
  const notes: string[] = [];
  if (flattened) notes.push("O arquivo não tem camadas separadas; foi importada a imagem final.");
  if (counters.text > 0) {
    notes.push(
      `${plural(counters.text, "camada de texto virou", "camadas de texto viraram")} pixels (o texto não é editável).`,
    );
  }
  if (counters.smartObjects > 0) {
    notes.push(
      `${plural(counters.smartObjects, "objeto inteligente foi", "objetos inteligentes foram")} importado como pixels.`,
    );
  }
  if (counters.effects > 0) {
    notes.push(
      `Estilos de camada (sombras, brilhos, traços) de ${plural(counters.effects, "camada não foram", "camadas não foram")} importados.`,
    );
  }
  if (counters.adjustments > 0) {
    notes.push(
      `${plural(counters.adjustments, "camada de ajuste foi ignorada", "camadas de ajuste foram ignoradas")}.`,
    );
  }
  if (counters.blendModes > 0) {
    notes.push(
      `${plural(counters.blendModes, "modo de mistura sem equivalente virou", "modos de mistura sem equivalente viraram")} Normal.`,
    );
  }
  if (counters.clips > 0) {
    notes.push(
      `${plural(counters.clips, "máscara de corte não pôde ser mantida", "máscaras de corte não puderam ser mantidas")}.`,
    );
  }
  if (counters.flattenedGroups > 0) {
    notes.push("Grupos muito aninhados foram achatados.");
  }
  if (psd.colorMode === COLOR_MODE_CMYK) {
    notes.push("O PSD é CMYK; as cores foram convertidas para RGB sem perfil e podem mudar.");
  }
  if (psd.bitsPerChannel !== undefined && psd.bitsPerChannel !== 8) {
    notes.push("O PSD tem mais de 8 bits por canal; foi reduzido para 8 bits.");
  }
  return notes;
};

const compositeLayer = (psd: Psd, context: Context): DesignElement[] => {
  if (psd.imageData === undefined) return [];
  const flat: Layer = { name: "Imagem", left: 0, top: 0, imageData: psd.imageData };
  const raster = rasterOf(flat, null, undefined, context);
  return raster === null ? [] : [raster];
};

export const psdToDesign = (
  psd: Psd,
  options: { newId: () => string; budgetBytes?: number },
): Result<{ design: ImportedDesign }> => {
  const fits = sizeFitsPage(psd.width, psd.height);
  if (!fits.ok) return fits;
  const context: Context = {
    width: psd.width,
    height: psd.height,
    newId: options.newId,
    budgetBytes: options.budgetBytes ?? DESIGN_IMPORT_LIMITS.psdMemoryBytes,
    usedBytes: 0,
    buffers: new Map(),
    counters: newCounters(),
  };
  try {
    const layered = emitLayers(psd.children ?? [], null, 0, context);
    const flattened = layered.length === 0;
    const elements = flattened ? compositeLayer(psd, context) : layered;
    if (elements.length === 0) return invalid(DESIGN_IMPORT_MESSAGE.noLayers);
    const notes = notesOf(context.counters, psd, flattened);
    return {
      ok: true,
      design: {
        format: DesignImportFormat.Psd,
        width: psd.width,
        height: psd.height,
        elements,
        buffers: context.buffers,
        notes,
      },
    };
  } catch (error) {
    if (error instanceof MemoryLimitError) return invalid(DESIGN_IMPORT_MESSAGE.memory);
    throw error;
  }
};

export const readPsdFile = async (
  bytes: Uint8Array,
  newId: () => string,
): Promise<Result<{ design: ImportedDesign }>> => {
  const header = readPsdHeader(bytes);
  if (!header.ok) return header;
  const { readPsd } = await import("ag-psd");
  try {
    const psd = readPsd(bytes, {
      useImageData: true,
      skipThumbnail: true,
      skipLinkedFilesData: true,
      totalMemoryLimit: DESIGN_IMPORT_LIMITS.psdMemoryBytes,
    });
    return psdToDesign(psd, { newId });
  } catch (error) {
    logError("psd import failed", error);
    return invalid(DESIGN_IMPORT_MESSAGE.psdCorrupt);
  }
};
