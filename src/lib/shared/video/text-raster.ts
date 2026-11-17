import { loadDesignFont } from "@/lib/shared/design/fonts";
import { DesignTextAlign, designFontFamily } from "@/lib/shared/design/types";
import type { TextClip } from "@/lib/shared/video/schemas";

export type TextRaster = {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
};

const LINE_HEIGHT = 1.2;
const PADDING_RATIO = 0.3;

const fontOf = (clip: TextClip) =>
  `${clip.italic ? "italic " : ""}${clip.bold ? 700 : 400} ${clip.fontSize}px "${designFontFamily(clip.font)}"`;

const wrapParagraph = (
  context: CanvasRenderingContext2D,
  paragraph: string,
  width: number,
): string[] => {
  const words = paragraph.split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line === "" ? word : `${line} ${word}`;
    if (line !== "" && context.measureText(candidate).width > width) {
      lines.push(line);
      line = word;
      continue;
    }
    line = candidate;
  }
  lines.push(line);
  return lines;
};

const lineX = (clip: TextClip, padding: number) => {
  if (clip.align === DesignTextAlign.Center) return padding + clip.width / 2;
  if (clip.align === DesignTextAlign.Right) return padding + clip.width;
  return padding;
};

export const textRasterKey = (clip: TextClip): string =>
  JSON.stringify([
    clip.text,
    clip.width,
    clip.font,
    clip.fontSize,
    clip.bold,
    clip.italic,
    clip.color,
    clip.align,
    clip.background,
  ]);

export const rasterizeText = async (clip: TextClip): Promise<TextRaster | null> => {
  await loadDesignFont(clip.font, clip.bold, clip.italic);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.font = fontOf(clip);
  const lines = clip.text.split("\n").flatMap((part) => wrapParagraph(context, part, clip.width));
  const padding = clip.background === null ? 0 : Math.round(clip.fontSize * PADDING_RATIO);
  const lineHeight = clip.fontSize * LINE_HEIGHT;
  canvas.width = Math.ceil(clip.width + padding * 2);
  canvas.height = Math.ceil(lines.length * lineHeight + padding * 2);
  if (clip.background !== null) {
    context.fillStyle = clip.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.font = fontOf(clip);
  context.fillStyle = clip.color;
  context.textAlign = clip.align;
  context.textBaseline = "middle";
  lines.forEach((line, index) => {
    context.fillText(line, lineX(clip, padding), padding + lineHeight * (index + 0.5));
  });
  return {
    canvas,
    x: clip.x - padding,
    y: clip.y - padding,
    width: canvas.width,
    height: canvas.height,
  };
};
