import { raceWithLimits, errorName } from "@/lib/shared/design/import/run-limits";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import type { SvgDocument, SvgParser } from "@/lib/shared/design/import/handlers/svg-gate";
import { logError } from "@/lib/shared/logger";
import { type Result, invalid } from "@/lib/shared/server-utils";

export type SvgPixels = { width: number; height: number; data: Uint8ClampedArray };

export type SvgRenderLimits = { timeoutMs: number; signal?: AbortSignal | undefined };

export type SvgRender = (
  svg: Blob,
  target: { width: number; height: number },
  limits: SvgRenderLimits,
) => Promise<Result<{ pixels: SvgPixels }>>;

export const domSvgParser: SvgParser = (text) => {
  const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = parsed.documentElement;
  const document: SvgDocument = {
    root,
    setRootSize: (width, height) => {
      root.setAttribute("width", String(width));
      root.setAttribute("height", String(height));
    },
    serialize: () => new XMLSerializer().serializeToString(parsed),
  };
  return document;
};

const loadImage = async (url: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return image;
};

const drawPixels = (image: HTMLImageElement, target: { width: number; height: number }) => {
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) return null;
    context.drawImage(image, 0, 0, target.width, target.height);
    return context.getImageData(0, 0, target.width, target.height);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
};

const renderFromUrl = async (
  url: string,
  target: { width: number; height: number },
): Promise<Result<{ pixels: SvgPixels }>> => {
  const image = await loadImage(url);
  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    return invalid(DESIGN_IMPORT_MESSAGE.svgRender);
  }
  const pixels = drawPixels(image, target);
  if (pixels === null) return invalid(DESIGN_IMPORT_MESSAGE.svgRender);
  return { ok: true, pixels: { width: pixels.width, height: pixels.height, data: pixels.data } };
};

export const renderSvgBlob: SvgRender = async (svg, target, limits) => {
  const url = URL.createObjectURL(svg);
  try {
    return await raceWithLimits(renderFromUrl(url, target), limits);
  } catch (error) {
    logError("svg render failed", errorName(error));
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
};
