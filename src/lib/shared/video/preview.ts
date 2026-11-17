import { DESIGN_PRESET_SIZE, type DesignPreset, type PageSize } from "@/lib/shared/design/types";
import type { FrameImage, FrameLayer, FrameScene } from "@/lib/shared/video/compose";
import type { AudioClip, VideoDocument } from "@/lib/shared/video/schemas";
import { type TextRaster, textRasterKey } from "@/lib/shared/video/text-raster";
import { activeAt, fadeLevel, mainStarts } from "@/lib/shared/video/timeline";
import { VideoClipKind } from "@/lib/shared/video/types";

export type PreviewAssets = {
  videoOf: (clipId: string) => HTMLVideoElement | undefined;
  imageOf: (mediaVersionId: string) => HTMLImageElement | null | undefined;
  textOf: (key: string) => TextRaster | undefined;
};

export type MediaTiming = {
  clipId: string;
  mediaVersionId: string;
  startMs: number;
  durationMs: number;
  sourceInMs: number;
  volumeAt: (timeMs: number) => number;
};

const imageFrame = (image: HTMLImageElement | null | undefined): FrameImage | null =>
  image === null || image === undefined || image.naturalWidth === 0
    ? null
    : { image, width: image.naturalWidth, height: image.naturalHeight };

const videoFrame = (video: HTMLVideoElement | undefined): FrameImage | null =>
  video === undefined || video.readyState < 2 || video.videoWidth === 0
    ? null
    : { image: video, width: video.videoWidth, height: video.videoHeight };

export const previewScene = (
  document: VideoDocument,
  preset: DesignPreset,
  timeMs: number,
  durationMs: number,
  scale: number,
  assets: PreviewAssets,
): FrameScene => {
  const frame = activeAt(document, timeMs);
  const main = frame.main?.clip;
  const source =
    main === undefined
      ? null
      : main.kind === VideoClipKind.Video
        ? videoFrame(assets.videoOf(main.id))
        : imageFrame(assets.imageOf(main.mediaVersionId));
  const overlays: FrameLayer[] = frame.overlays.flatMap((clip) => {
    const image = imageFrame(assets.imageOf(clip.mediaVersionId));
    if (image === null) return [];
    return [
      {
        ...image,
        x: clip.x,
        y: clip.y,
        boxWidth: clip.width,
        boxHeight: clip.height,
        opacity: clip.opacity,
      },
    ];
  });
  const texts: FrameLayer[] = frame.texts.flatMap((clip) => {
    const raster = assets.textOf(textRasterKey(clip));
    if (raster === undefined) return [];
    return [
      {
        image: raster.canvas,
        width: raster.width,
        height: raster.height,
        x: raster.x,
        y: raster.y,
        boxWidth: raster.width,
        boxHeight: raster.height,
        opacity: 1,
      },
    ];
  });
  return {
    size: DESIGN_PRESET_SIZE[preset],
    scale,
    background: document.background,
    main: source === null || main === undefined ? null : { ...source, fit: main.fit },
    layers: [...overlays, ...texts],
    fade: fadeLevel(document, timeMs, durationMs),
  };
};

const audioEnvelope = (clip: AudioClip, timeMs: number): number => {
  const local = timeMs - clip.startMs;
  const fadeIn = clip.fadeInMs > 0 ? local / clip.fadeInMs : 1;
  const fadeOut = clip.fadeOutMs > 0 ? (clip.durationMs - local) / clip.fadeOutMs : 1;
  return clip.volume * Math.min(1, Math.max(0, Math.min(fadeIn, fadeOut)));
};

export const mediaTimings = (document: VideoDocument): MediaTiming[] => {
  const starts = mainStarts(document);
  const main = document.main.flatMap((clip, index) =>
    clip.kind === VideoClipKind.Video
      ? [
          {
            clipId: clip.id,
            mediaVersionId: clip.mediaVersionId,
            startMs: starts[index] ?? 0,
            durationMs: clip.durationMs,
            sourceInMs: clip.sourceInMs,
            volumeAt: () => clip.volume,
          },
        ]
      : [],
  );
  const audio = document.audio.map((clip) => ({
    clipId: clip.id,
    mediaVersionId: clip.mediaVersionId,
    startMs: clip.startMs,
    durationMs: clip.durationMs,
    sourceInMs: clip.sourceInMs,
    volumeAt: (timeMs: number) => audioEnvelope(clip, timeMs),
  }));
  return [...main, ...audio];
};

export const isTimingActive = (timing: MediaTiming, timeMs: number): boolean =>
  timing.startMs <= timeMs && timeMs < timing.startMs + timing.durationMs;

export const sourceSeconds = (timing: MediaTiming, timeMs: number): number =>
  (timing.sourceInMs + timeMs - timing.startMs) / 1000;

export type Clock = {
  get: () => number;
  set: (timeMs: number) => void;
  subscribe: (listener: () => void) => () => void;
};

export const createClock = (): Clock => {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (timeMs) => {
      if (timeMs === value) return;
      value = timeMs;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const MAX_PREVIEW_HEIGHT = 520;

export const previewScale = (size: PageSize): number =>
  Math.min(1, MAX_PREVIEW_HEIGHT / size.height);
