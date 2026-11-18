import type { Color, Layer, LayerTextData, Psd, TextStyle } from "ag-psd";
import {
  METADATA_LIMITS,
  type ImportedDesignMetadata,
  type MetadataColorInput,
  type MetadataLayerInput,
  type MetadataRgb,
  type MetadataTextInput,
  MetadataColorSource,
  MetadataLayerKind,
  buildMetadata,
} from "@/lib/shared/design/import/metadata";
import { DesignImportColorMode, DesignImportFormat } from "@/lib/shared/design/import/types";

const PASS_THROUGH = "pass through";
const NORMAL = "normal";
const BYTE_RANGE = 255;
const MAX_STYLES_PER_LAYER = 1000;
const MAX_DISTINCT_KEYS = 10_000;

const COLOR_MODES: Readonly<Record<number, DesignImportColorMode>> = {
  0: DesignImportColorMode.Bitmap,
  1: DesignImportColorMode.Grayscale,
  2: DesignImportColorMode.Indexed,
  3: DesignImportColorMode.Rgb,
  4: DesignImportColorMode.Cmyk,
};

type Frame = { layers: readonly Layer[]; next: number; parent: number | null };

type Collected = {
  layers: MetadataLayerInput[];
  texts: MetadataTextInput[];
  fonts: Map<string, number>;
  colors: Map<string, MetadataColorInput>;
};

const rgbOf = (color: Color | undefined): MetadataRgb | null => {
  if (color === undefined) return null;
  if ("fr" in color) {
    return {
      r: Math.round(color.fr * BYTE_RANGE),
      g: Math.round(color.fg * BYTE_RANGE),
      b: Math.round(color.fb * BYTE_RANGE),
    };
  }
  if ("r" in color && "g" in color && "b" in color) return { r: color.r, g: color.g, b: color.b };
  return null;
};

const kindOf = (layer: Layer): MetadataLayerKind => {
  if (layer.children !== undefined) return MetadataLayerKind.Group;
  if (layer.adjustment !== undefined) return MetadataLayerKind.Adjustment;
  if (layer.text !== undefined) return MetadataLayerKind.Text;
  if (layer.placedLayer !== undefined) return MetadataLayerKind.SmartObject;
  if (
    layer.vectorMask !== undefined ||
    layer.vectorFill !== undefined ||
    layer.vectorStroke !== undefined
  ) {
    return MetadataLayerKind.Shape;
  }
  return layer.rawData !== undefined || layer.imageData !== undefined || layer.canvas !== undefined
    ? MetadataLayerKind.Raster
    : MetadataLayerKind.Unknown;
};

const boundsOf = (layer: Layer): MetadataLayerInput["bounds"] => {
  const { left, top, right, bottom } = layer;
  if (left === undefined || top === undefined || right === undefined || bottom === undefined) {
    return null;
  }
  return { left, top, width: right - left, height: bottom - top };
};

const stylesOf = (text: LayerTextData): TextStyle[] => {
  const runs = (text.styleRuns ?? []).slice(0, MAX_STYLES_PER_LAYER).map((run) => run.style);
  if (runs.length > 0) return runs;
  return text.style === undefined ? [] : [text.style];
};

const bump = <T>(map: Map<string, T>, key: string, make: (known: T | undefined) => T): void => {
  if (map.has(key) || map.size < MAX_DISTINCT_KEYS) map.set(key, make(map.get(key)));
};

const noteColor = (collected: Collected, color: MetadataRgb, source: MetadataColorSource): void => {
  const key = `${color.r},${color.g},${color.b},${source}`;
  bump(collected.colors, key, (known) => ({ ...color, source, count: (known?.count ?? 0) + 1 }));
};

const collectText = (collected: Collected, layerIndex: number, text: LayerTextData): void => {
  const styles = stylesOf(text);
  const named = styles.map((style) => style.font?.name).filter((name) => name !== undefined);
  for (const name of named) bump(collected.fonts, name, (known) => (known ?? 0) + 1);
  for (const style of styles) {
    const color = rgbOf(style.fillColor);
    if (color !== null) noteColor(collected, color, MetadataColorSource.Text);
  }
  const first = styles[0] ?? text.style;
  collected.texts.push({
    layerIndex,
    text: text.text,
    fontName: named[0] ?? text.style?.font?.name ?? null,
    fontSize: first?.fontSize ?? null,
    color: rgbOf(first?.fillColor),
  });
};

const collectFill = (collected: Collected, layer: Layer): void => {
  const fill = layer.vectorFill;
  if (fill === undefined || fill.type !== "color") return;
  const color = rgbOf(fill.color);
  if (color !== null) noteColor(collected, color, MetadataColorSource.Fill);
};

const describeLayer = (layer: Layer, parent: number | null): MetadataLayerInput => {
  const kind = kindOf(layer);
  const group = kind === MetadataLayerKind.Group;
  return {
    parentIndex: parent,
    name: layer.name ?? "",
    kind,
    visible: layer.hidden !== true,
    opacity: layer.opacity ?? 1,
    blendMode: layer.blendMode ?? (group ? PASS_THROUGH : NORMAL),
    bounds: group ? null : boundsOf(layer),
  };
};

const walk = (psd: Psd): Collected => {
  const collected: Collected = { layers: [], texts: [], fonts: new Map(), colors: new Map() };
  const stack: Frame[] = [{ layers: psd.children ?? [], next: 0, parent: null }];
  while (stack.length > 0 && collected.layers.length <= METADATA_LIMITS.maxLayers) {
    const frame = stack.at(-1);
    const layer = frame?.layers[frame.next];
    if (frame === undefined) break;
    if (layer === undefined) {
      stack.pop();
      continue;
    }
    frame.next += 1;
    const index = collected.layers.length;
    collected.layers.push(describeLayer(layer, frame.parent));
    if (layer.children !== undefined) {
      stack.push({ layers: layer.children, next: 0, parent: index });
      continue;
    }
    if (layer.text !== undefined && layer.adjustment === undefined) {
      collectText(collected, index, layer.text);
    }
    collectFill(collected, layer);
  }
  return collected;
};

export const extractPsdMetadata = (psd: Psd): ImportedDesignMetadata | null => {
  try {
    const collected = walk(psd);
    return buildMetadata({
      source: {
        format: DesignImportFormat.Psd,
        colorMode: COLOR_MODES[psd.colorMode ?? -1] ?? DesignImportColorMode.Unknown,
        bitsPerChannel: psd.bitsPerChannel ?? null,
        pageCount: null,
      },
      dimensions: {
        sourceWidth: psd.width,
        sourceHeight: psd.height,
        pageWidth: psd.width,
        pageHeight: psd.height,
      },
      layers: collected.layers,
      textRuns: collected.texts,
      fonts: [...collected.fonts].map(([name, usageCount]) => ({ name, usageCount })),
      colors: [...collected.colors.values()],
    });
  } catch {
    return null;
  }
};
