import type { PageSize } from "@/lib/shared/design/types";
import { VideoFit } from "@/lib/shared/video/types";

export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type FrameImage = { image: CanvasImageSource; width: number; height: number };

export type FrameLayer = FrameImage & {
  x: number;
  y: number;
  boxWidth: number;
  boxHeight: number;
  opacity: number;
};

export type FrameScene = {
  size: PageSize;
  scale: number;
  background: string;
  main: (FrameImage & { fit: VideoFit }) | null;
  layers: readonly FrameLayer[];
  fade: number;
};

type Rect = { x: number; y: number; width: number; height: number };

export const fitRect = (source: PageSize, target: PageSize, fit: VideoFit): Rect => {
  const ratio =
    fit === VideoFit.Cover
      ? Math.max(target.width / source.width, target.height / source.height)
      : Math.min(target.width / source.width, target.height / source.height);
  const width = source.width * ratio;
  const height = source.height * ratio;
  return { x: (target.width - width) / 2, y: (target.height - height) / 2, width, height };
};

const drawMain = (context: Context2D, scene: FrameScene) => {
  const { main } = scene;
  if (main === null || main.width <= 0 || main.height <= 0) return;
  const target = {
    width: scene.size.width * scene.scale,
    height: scene.size.height * scene.scale,
  };
  const rect = fitRect(main, target, main.fit);
  context.drawImage(main.image, rect.x, rect.y, rect.width, rect.height);
};

const drawLayer = (context: Context2D, layer: FrameLayer, factor: number) => {
  if (layer.opacity <= 0) return;
  context.globalAlpha = Math.min(1, layer.opacity);
  context.drawImage(
    layer.image,
    layer.x * factor,
    layer.y * factor,
    layer.boxWidth * factor,
    layer.boxHeight * factor,
  );
  context.globalAlpha = 1;
};

export const composeFrame = (context: Context2D, scene: FrameScene) => {
  const width = scene.size.width * scene.scale;
  const height = scene.size.height * scene.scale;
  context.globalAlpha = 1;
  context.fillStyle = scene.background;
  context.fillRect(0, 0, width, height);
  drawMain(context, scene);
  for (const layer of scene.layers) drawLayer(context, layer, scene.scale);
  if (scene.fade >= 1) return;
  context.globalAlpha = 1 - Math.max(0, scene.fade);
  context.fillStyle = scene.background;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
};
