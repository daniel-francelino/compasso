import {
  DESIGN_PRESET_SIZE,
  DesignFont,
  type DesignPreset,
  DesignTextAlign,
} from "@/lib/shared/design/types";
import type {
  AudioClip,
  MainClip,
  OverlayClip,
  TextClip,
  VideoDocument,
} from "@/lib/shared/video/schemas";
import {
  VIDEO_LIMITS,
  VideoClipKind,
  VideoFit,
  VideoTrack,
  VideoTrimEdge,
} from "@/lib/shared/video/types";

export type ClipRef = { track: VideoTrack; id: string };

export type TimedClip = ClipRef & { startMs: number; durationMs: number };

export type ActiveFrame = {
  main: { clip: MainClip; localMs: number } | null;
  overlays: OverlayClip[];
  texts: TextClip[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value);

export const frameMs = 1000 / VIDEO_LIMITS.fps;

export const emptyVideoDocument = (background: string): VideoDocument => ({
  version: 1,
  background,
  fadeInMs: 0,
  fadeOutMs: 0,
  main: [],
  overlays: [],
  texts: [],
  audio: [],
});

export const mainStarts = (document: VideoDocument): number[] => {
  const starts: number[] = [];
  let cursor = 0;
  for (const clip of document.main) {
    starts.push(cursor);
    cursor += clip.durationMs;
  }
  return starts;
};

export const mainTotal = (document: VideoDocument): number =>
  document.main.reduce((total, clip) => total + clip.durationMs, 0);

const endOf = (clip: { startMs: number; durationMs: number }) => clip.startMs + clip.durationMs;

export const projectDuration = (document: VideoDocument): number =>
  Math.max(
    mainTotal(document),
    ...document.overlays.map(endOf),
    ...document.texts.map(endOf),
    ...document.audio.map(endOf),
  );

export const frameCount = (durationMs: number): number =>
  Math.ceil((durationMs * VIDEO_LIMITS.fps) / 1000);

export const snapToFrame = (ms: number): number => round(Math.round(ms / frameMs) * frameMs);

export const timedClips = (document: VideoDocument): TimedClip[] => {
  const starts = mainStarts(document);
  return [
    ...document.main.map((clip, index) => ({
      track: VideoTrack.Main,
      id: clip.id,
      startMs: starts[index] ?? 0,
      durationMs: clip.durationMs,
    })),
    ...document.overlays.map((clip) => ({ track: VideoTrack.Overlay, ...pickTiming(clip) })),
    ...document.texts.map((clip) => ({ track: VideoTrack.Text, ...pickTiming(clip) })),
    ...document.audio.map((clip) => ({ track: VideoTrack.Audio, ...pickTiming(clip) })),
  ];
};

const pickTiming = (clip: { id: string; startMs: number; durationMs: number }) => ({
  id: clip.id,
  startMs: clip.startMs,
  durationMs: clip.durationMs,
});

export const findTimed = (document: VideoDocument, ref: ClipRef): TimedClip | undefined =>
  timedClips(document).find((clip) => clip.track === ref.track && clip.id === ref.id);

export const sameRef = (a: ClipRef | null, b: ClipRef | null): boolean =>
  a !== null && b !== null && a.track === b.track && a.id === b.id;

export const isWithinLimit = (document: VideoDocument): boolean =>
  projectDuration(document) <= VIDEO_LIMITS.maxDurationMs;

export const documentBytes = (document: VideoDocument): number =>
  new TextEncoder().encode(JSON.stringify(document)).length;

export const isTooLarge = (document: VideoDocument): boolean =>
  documentBytes(document) > VIDEO_LIMITS.maxBytes;

export const canAdd = (document: VideoDocument, track: VideoTrack): boolean => {
  if (track === VideoTrack.Main) return document.main.length < VIDEO_LIMITS.maxMainClips;
  if (track === VideoTrack.Overlay) return document.overlays.length < VIDEO_LIMITS.maxOverlays;
  if (track === VideoTrack.Text) return document.texts.length < VIDEO_LIMITS.maxTexts;
  return document.audio.length < VIDEO_LIMITS.maxAudio;
};

export const remainingMs = (document: VideoDocument): number =>
  VIDEO_LIMITS.maxDurationMs - mainTotal(document);

export const createMainClip = (
  id: string,
  kind: VideoClipKind,
  mediaVersionId: string,
  durationMs: number,
): MainClip => ({
  id,
  kind,
  mediaVersionId,
  durationMs: round(clamp(durationMs, VIDEO_LIMITS.minClipMs, VIDEO_LIMITS.maxDurationMs)),
  sourceInMs: 0,
  volume: kind === VideoClipKind.Video ? 1 : 0,
  fit: VideoFit.Cover,
});

export const createOverlayClip = (
  id: string,
  mediaVersionId: string,
  preset: DesignPreset,
  natural: { width: number; height: number },
  startMs: number,
  durationMs: number,
): OverlayClip => {
  const page = DESIGN_PRESET_SIZE[preset];
  const width = Math.round(page.width / 4);
  const height = Math.max(
    VIDEO_LIMITS.minSize,
    Math.round((width * natural.height) / Math.max(1, natural.width)),
  );
  const margin = Math.round(page.width / 24);
  return {
    id,
    mediaVersionId,
    startMs: round(startMs),
    durationMs: round(durationMs),
    x: page.width - width - margin,
    y: margin,
    width,
    height,
    opacity: 1,
  };
};

export const createTextClip = (
  id: string,
  preset: DesignPreset,
  color: string,
  startMs: number,
  durationMs: number,
): TextClip => {
  const page = DESIGN_PRESET_SIZE[preset];
  const width = Math.round(page.width * 0.8);
  return {
    id,
    text: "Seu texto aqui",
    startMs: round(startMs),
    durationMs: round(durationMs),
    x: Math.round((page.width - width) / 2),
    y: Math.round(page.height * 0.7),
    width,
    font: DesignFont.DmSans,
    fontSize: 72,
    bold: true,
    italic: false,
    color,
    align: DesignTextAlign.Center,
    background: null,
  };
};

export const createAudioClip = (
  id: string,
  mediaVersionId: string,
  startMs: number,
  durationMs: number,
): AudioClip => ({
  id,
  mediaVersionId,
  startMs: round(startMs),
  durationMs: round(clamp(durationMs, VIDEO_LIMITS.minClipMs, VIDEO_LIMITS.maxDurationMs)),
  sourceInMs: 0,
  volume: 1,
  fadeInMs: 0,
  fadeOutMs: 0,
});

export const addMainClip = (document: VideoDocument, clip: MainClip): VideoDocument => ({
  ...document,
  main: [...document.main, clip],
});

export const addOverlayClip = (document: VideoDocument, clip: OverlayClip): VideoDocument => ({
  ...document,
  overlays: [...document.overlays, clip],
});

export const addTextClip = (document: VideoDocument, clip: TextClip): VideoDocument => ({
  ...document,
  texts: [...document.texts, clip],
});

export const addAudioClip = (document: VideoDocument, clip: AudioClip): VideoDocument => ({
  ...document,
  audio: [...document.audio, clip],
});

const patchList = <T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] =>
  list.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip));

export const patchMainClip = (document: VideoDocument, id: string, patch: Partial<MainClip>) => ({
  ...document,
  main: patchList(document.main, id, patch),
});

export const patchOverlayClip = (
  document: VideoDocument,
  id: string,
  patch: Partial<OverlayClip>,
) => ({ ...document, overlays: patchList(document.overlays, id, patch) });

export const patchTextClip = (document: VideoDocument, id: string, patch: Partial<TextClip>) => ({
  ...document,
  texts: patchList(document.texts, id, patch),
});

export const patchAudioClip = (document: VideoDocument, id: string, patch: Partial<AudioClip>) => ({
  ...document,
  audio: patchList(document.audio, id, patch),
});

export const removeClip = (document: VideoDocument, ref: ClipRef): VideoDocument => {
  const keep = <T extends { id: string }>(list: T[]) => list.filter((clip) => clip.id !== ref.id);
  if (ref.track === VideoTrack.Main) return { ...document, main: keep(document.main) };
  if (ref.track === VideoTrack.Overlay) return { ...document, overlays: keep(document.overlays) };
  if (ref.track === VideoTrack.Text) return { ...document, texts: keep(document.texts) };
  return { ...document, audio: keep(document.audio) };
};

export const moveMainClip = (document: VideoDocument, id: string, delta: number): VideoDocument => {
  const index = document.main.findIndex((clip) => clip.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= document.main.length) return document;
  const main = [...document.main];
  const [clip] = main.splice(index, 1);
  if (clip === undefined) return document;
  main.splice(target, 0, clip);
  return { ...document, main };
};

export const setClipStart = (
  document: VideoDocument,
  ref: ClipRef,
  startMs: number,
): VideoDocument => {
  const value = round(clamp(startMs, 0, VIDEO_LIMITS.maxDurationMs - VIDEO_LIMITS.minClipMs));
  if (ref.track === VideoTrack.Overlay)
    return patchOverlayClip(document, ref.id, { startMs: value });
  if (ref.track === VideoTrack.Text) return patchTextClip(document, ref.id, { startMs: value });
  if (ref.track === VideoTrack.Audio) return patchAudioClip(document, ref.id, { startMs: value });
  return document;
};

const sourceInOf = (document: VideoDocument, ref: ClipRef): number | null => {
  if (ref.track === VideoTrack.Main) {
    const clip = document.main.find((item) => item.id === ref.id);
    return clip?.kind === VideoClipKind.Video ? clip.sourceInMs : null;
  }
  if (ref.track === VideoTrack.Audio) {
    return document.audio.find((item) => item.id === ref.id)?.sourceInMs ?? null;
  }
  return null;
};

const applyTiming = (
  document: VideoDocument,
  ref: ClipRef,
  timing: { startMs: number; durationMs: number; sourceInMs: number | null },
): VideoDocument => {
  const source = timing.sourceInMs === null ? {} : { sourceInMs: timing.sourceInMs };
  if (ref.track === VideoTrack.Main) {
    return patchMainClip(document, ref.id, { durationMs: timing.durationMs, ...source });
  }
  const placed = { startMs: timing.startMs, durationMs: timing.durationMs };
  if (ref.track === VideoTrack.Overlay) return patchOverlayClip(document, ref.id, placed);
  if (ref.track === VideoTrack.Text) return patchTextClip(document, ref.id, placed);
  return patchAudioClip(document, ref.id, { ...placed, ...source });
};

export const trimClip = (
  document: VideoDocument,
  ref: ClipRef,
  edge: VideoTrimEdge,
  deltaMs: number,
  sourceDurationMs: number | null,
): VideoDocument => {
  const timed = findTimed(document, ref);
  if (timed === undefined) return document;
  const sourceIn = sourceInOf(document, ref);
  const sourceEnd =
    sourceIn === null || sourceDurationMs === null ? null : sourceDurationMs - sourceIn;
  if (edge === VideoTrimEdge.End) {
    const maxDuration = Math.min(VIDEO_LIMITS.maxDurationMs, sourceEnd ?? Number.POSITIVE_INFINITY);
    const durationMs = round(
      clamp(timed.durationMs + deltaMs, VIDEO_LIMITS.minClipMs, maxDuration),
    );
    return applyTiming(document, ref, { startMs: timed.startMs, durationMs, sourceInMs: sourceIn });
  }
  const minDelta = Math.max(
    sourceIn === null ? Number.NEGATIVE_INFINITY : -sourceIn,
    ref.track === VideoTrack.Main ? Number.NEGATIVE_INFINITY : -timed.startMs,
  );
  const maxDelta = timed.durationMs - VIDEO_LIMITS.minClipMs;
  const delta = round(clamp(deltaMs, minDelta, maxDelta));
  return applyTiming(document, ref, {
    startMs: timed.startMs + delta,
    durationMs: timed.durationMs - delta,
    sourceInMs: sourceIn === null ? null : sourceIn + delta,
  });
};

export const clipAt = (document: VideoDocument, track: VideoTrack, timeMs: number) =>
  timedClips(document).find(
    (clip) =>
      clip.track === track && clip.startMs <= timeMs && timeMs < clip.startMs + clip.durationMs,
  );

export const clipRefAt = (
  document: VideoDocument,
  track: VideoTrack,
  timeMs: number,
): ClipRef | undefined => {
  const found = clipAt(document, track, timeMs);
  return found === undefined ? undefined : { track: found.track, id: found.id };
};

export const canSplit = (document: VideoDocument, ref: ClipRef, timeMs: number): boolean => {
  const timed = findTimed(document, ref);
  if (timed === undefined) return false;
  const offset = timeMs - timed.startMs;
  return offset >= VIDEO_LIMITS.minClipMs && timed.durationMs - offset >= VIDEO_LIMITS.minClipMs;
};

const splitList = <T extends { id: string; durationMs: number }>(
  list: T[],
  id: string,
  offset: number,
  second: (clip: T) => T,
): T[] =>
  list.flatMap((clip) =>
    clip.id === id ? [{ ...clip, durationMs: offset }, second(clip)] : [clip],
  );

export const splitClip = (
  document: VideoDocument,
  ref: ClipRef,
  timeMs: number,
  newId: string,
): VideoDocument => {
  const timed = findTimed(document, ref);
  if (timed === undefined || !canSplit(document, ref, timeMs)) return document;
  const offset = round(timeMs - timed.startMs);
  const rest = (clip: { durationMs: number }) => clip.durationMs - offset;
  if (ref.track === VideoTrack.Main) {
    return {
      ...document,
      main: splitList(document.main, ref.id, offset, (clip) => ({
        ...clip,
        id: newId,
        durationMs: rest(clip),
        sourceInMs: clip.kind === VideoClipKind.Video ? clip.sourceInMs + offset : 0,
      })),
    };
  }
  const later = <T extends { startMs: number; durationMs: number }>(clip: T): T => ({
    ...clip,
    id: newId,
    startMs: clip.startMs + offset,
    durationMs: rest(clip),
  });
  if (ref.track === VideoTrack.Overlay) {
    return { ...document, overlays: splitList(document.overlays, ref.id, offset, later) };
  }
  if (ref.track === VideoTrack.Text) {
    return { ...document, texts: splitList(document.texts, ref.id, offset, later) };
  }
  return {
    ...document,
    audio: splitList(document.audio, ref.id, offset, (clip) => ({
      ...later(clip),
      sourceInMs: clip.sourceInMs + offset,
      fadeInMs: 0,
    })),
  };
};

const isActive = (clip: { startMs: number; durationMs: number }, timeMs: number) =>
  clip.startMs <= timeMs && timeMs < clip.startMs + clip.durationMs;

export const activeAt = (document: VideoDocument, timeMs: number): ActiveFrame => {
  const starts = mainStarts(document);
  const index = document.main.findIndex((clip, position) =>
    isActive({ startMs: starts[position] ?? 0, durationMs: clip.durationMs }, timeMs),
  );
  const clip = document.main[index];
  return {
    main: clip === undefined ? null : { clip, localMs: timeMs - (starts[index] ?? 0) },
    overlays: document.overlays.filter((item) => isActive(item, timeMs)),
    texts: document.texts.filter((item) => isActive(item, timeMs)),
  };
};

export const fadeLevel = (
  document: Pick<VideoDocument, "fadeInMs" | "fadeOutMs">,
  timeMs: number,
  durationMs: number,
): number => {
  const fadeIn = document.fadeInMs > 0 ? timeMs / document.fadeInMs : 1;
  const fadeOut = document.fadeOutMs > 0 ? (durationMs - timeMs) / document.fadeOutMs : 1;
  return clamp(Math.min(fadeIn, fadeOut), 0, 1);
};

export const snapTargetsOf = (
  document: VideoDocument,
  exclude: ClipRef,
  playheadMs: number,
): number[] => {
  const edges = timedClips(document)
    .filter((clip) => !sameRef(clip, exclude))
    .flatMap((clip) => [clip.startMs, clip.startMs + clip.durationMs]);
  return [0, playheadMs, ...edges];
};

export const snapValue = (value: number, targets: readonly number[], threshold: number): number => {
  let best = value;
  let distance = threshold;
  for (const target of targets) {
    const gap = Math.abs(target - value);
    if (gap <= distance) {
      best = target;
      distance = gap;
    }
  }
  return best;
};

export const mediaVersionIds = (document: VideoDocument): string[] => [
  ...new Set([
    ...document.main.map((clip) => clip.mediaVersionId),
    ...document.overlays.map((clip) => clip.mediaVersionId),
    ...document.audio.map((clip) => clip.mediaVersionId),
  ]),
];

export const formatTimecode = (ms: number): string => {
  const safe = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
};
