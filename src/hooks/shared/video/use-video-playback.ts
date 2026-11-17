import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadImage } from "@/lib/shared/design/browser";
import type { DesignPreset } from "@/lib/shared/design/types";
import { composeFrame } from "@/lib/shared/video/compose";
import {
  type MediaTiming,
  createClock,
  isTimingActive,
  mediaTimings,
  previewScene,
  sourceSeconds,
} from "@/lib/shared/video/preview";
import type { VideoDocument } from "@/lib/shared/video/schemas";
import { type TextRaster, rasterizeText, textRasterKey } from "@/lib/shared/video/text-raster";
import { frameMs } from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS } from "@/lib/shared/video/types";
import type { SourceUrls } from "@/hooks/shared/video/use-video-sources";

type Options = {
  document: VideoDocument;
  preset: DesignPreset;
  durationMs: number;
  urls: SourceUrls | undefined;
  scale: number;
};

const createMediaElement = (isMain: boolean): HTMLMediaElement => {
  const element = window.document.createElement(isMain ? "video" : "audio");
  element.crossOrigin = "anonymous";
  element.preload = "auto";
  if (element instanceof HTMLVideoElement) element.playsInline = true;
  return element;
};

const releaseElement = (element: HTMLMediaElement) => {
  element.pause();
  element.removeAttribute("src");
  element.load();
  element.remove();
};

const stop = (element: HTMLMediaElement) => {
  if (!element.paused) element.pause();
};

const seekIfAway = (element: HTMLMediaElement, seconds: number, tolerance: number) => {
  if (Math.abs(element.currentTime - seconds) > tolerance) element.currentTime = seconds;
};

const keepPlaying = (element: HTMLMediaElement, seconds: number) => {
  if (!element.paused) {
    seekIfAway(element, seconds, VIDEO_LIMITS.driftSeconds);
    return;
  }
  element.currentTime = seconds;
  void element.play().catch(() => undefined);
};

const syncElement = (
  element: HTMLMediaElement,
  timing: MediaTiming,
  timeMs: number,
  playing: boolean,
) => {
  if (!isTimingActive(timing, timeMs)) {
    stop(element);
    return;
  }
  const seconds = sourceSeconds(timing, timeMs);
  element.volume = Math.min(1, Math.max(0, timing.volumeAt(timeMs)));
  if (playing) {
    keepPlaying(element, seconds);
    return;
  }
  stop(element);
  seekIfAway(element, seconds, frameMs / 2000);
};

export const useVideoPlayback = ({ document, preset, durationMs, urls, scale }: Options) => {
  const clock = useMemo(createClock, []);
  const [playing, setPlaying] = useState(false);
  const [sourceDurations, setSourceDurations] = useState<ReadonlyMap<string, number>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const elements = useRef(new Map<string, HTMLMediaElement>());
  const images = useRef(new Map<string, HTMLImageElement | null>());
  const texts = useRef(new Map<string, TextRaster>());
  const state = useRef({ document, durationMs, playing, scale });
  state.current = { document, durationMs, playing, scale };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas === null || context === null || context === undefined) return;
    const current = state.current;
    const scene = previewScene(
      current.document,
      preset,
      clock.get(),
      current.durationMs,
      current.scale,
      {
        videoOf: (clipId) => {
          const element = elements.current.get(clipId);
          return element instanceof HTMLVideoElement ? element : undefined;
        },
        imageOf: (id) => images.current.get(id),
        textOf: (key) => texts.current.get(key),
      },
    );
    composeFrame(context, scene);
  }, [clock, preset]);

  const syncAll = useCallback((timeMs: number, isPlaying: boolean) => {
    for (const timing of mediaTimings(state.current.document)) {
      const element = elements.current.get(timing.clipId);
      if (element !== undefined) syncElement(element, timing, timeMs, isPlaying);
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const timings = mediaTimings(document);
    const wanted = new Set(timings.map((timing) => timing.clipId));
    for (const [clipId, element] of elements.current) {
      if (wanted.has(clipId)) continue;
      releaseElement(element);
      elements.current.delete(clipId);
    }
    const mainIds = new Set(document.main.map((clip) => clip.id));
    for (const timing of timings) {
      const url = urls?.videos[timing.mediaVersionId];
      if (url === undefined) continue;
      const existing = elements.current.get(timing.clipId);
      const element = existing ?? createMediaElement(mainIds.has(timing.clipId));
      if (existing === undefined) {
        element.addEventListener("seeked", () => !state.current.playing && draw());
        element.addEventListener("loadeddata", () => !state.current.playing && draw());
        element.addEventListener("loadedmetadata", () => {
          const seconds = element.duration;
          if (!Number.isFinite(seconds)) return;
          setSourceDurations((current) =>
            new Map(current).set(timing.mediaVersionId, Math.floor(seconds * 1000)),
          );
        });
        host?.append(element);
        elements.current.set(timing.clipId, element);
      }
      if (element.src !== url) element.src = url;
    }
    syncAll(clock.get(), state.current.playing);
  }, [document, urls, clock, draw, syncAll]);

  useEffect(() => {
    let active = true;
    for (const [id, url] of Object.entries(urls?.images ?? {})) {
      if (images.current.has(id)) continue;
      images.current.set(id, null);
      void loadImage(url).then((image) => {
        if (!active) return;
        images.current.set(id, image);
        draw();
      });
    }
    return () => {
      active = false;
    };
  }, [urls, draw]);

  useEffect(() => {
    let active = true;
    for (const clip of document.texts) {
      const key = textRasterKey(clip);
      if (texts.current.has(key)) continue;
      void rasterizeText(clip).then((raster) => {
        if (!active || raster === null) return;
        texts.current.set(key, raster);
        draw();
      });
    }
    return () => {
      active = false;
    };
  }, [document.texts, draw]);

  useEffect(() => {
    if (!playing) return undefined;
    const startedAt = performance.now();
    const from = clock.get() >= state.current.durationMs ? 0 : clock.get();
    let frame = 0;
    const tick = () => {
      const timeMs = Math.min(from + performance.now() - startedAt, state.current.durationMs);
      clock.set(timeMs);
      syncAll(timeMs, true);
      draw();
      if (timeMs >= state.current.durationMs) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      syncAll(clock.get(), false);
    };
  }, [playing, clock, draw, syncAll]);

  useEffect(() => {
    if (!playing) draw();
  }, [document, scale, playing, draw]);

  useEffect(
    () => () => {
      for (const element of elements.current.values()) releaseElement(element);
      elements.current.clear();
    },
    [],
  );

  const seek = useCallback(
    (timeMs: number) => {
      const value = Math.min(Math.max(0, Math.round(timeMs)), state.current.durationMs);
      clock.set(value);
      syncAll(value, state.current.playing);
      draw();
    },
    [clock, draw, syncAll],
  );

  return {
    clock,
    playing,
    canvasRef,
    hostRef,
    sourceDurations,
    play: () => state.current.durationMs > 0 && setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => setPlaying((value) => !value && state.current.durationMs > 0),
    seek,
    step: (frames: number) => seek(clock.get() + frames * frameMs),
  };
};

export type VideoPlayback = ReturnType<typeof useVideoPlayback>;
