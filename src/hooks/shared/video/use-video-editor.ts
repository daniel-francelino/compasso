import { useState } from "react";
import {
  type History,
  historyOf,
  pushHistory,
  redoHistory,
  undoHistory,
} from "@/lib/shared/design/history";
import type {
  AudioClip,
  MainClip,
  OverlayClip,
  TextClip,
  VideoDocument,
} from "@/lib/shared/video/schemas";
import {
  type ClipRef,
  addAudioClip,
  addMainClip,
  addOverlayClip,
  addTextClip,
  isWithinLimit,
  moveMainClip,
  patchAudioClip,
  patchMainClip,
  patchOverlayClip,
  patchTextClip,
  removeClip,
  sameRef,
  setClipStart,
  splitClip,
  trimClip,
} from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS, VideoTrack, type VideoTrimEdge } from "@/lib/shared/video/types";

const newId = () => crypto.randomUUID();

export type ProjectPatch = Partial<Pick<VideoDocument, "background" | "fadeInMs" | "fadeOutMs">>;

export const useVideoEditor = (initial: VideoDocument) => {
  const [history, setHistory] = useState<History<VideoDocument>>(() => historyOf(initial));
  const [selected, setSelected] = useState<ClipRef | null>(null);
  const document = history.present;

  const change = (update: (current: VideoDocument) => VideoDocument, mergeKey?: string) =>
    setHistory((current) => {
      const next = update(current.present);
      if (next === current.present || !isWithinLimit(next)) return current;
      return pushHistory(current, next, VIDEO_LIMITS.history, mergeKey ?? null);
    });

  const select = (ref: ClipRef | null) => setSelected(ref);

  const remove = (ref: ClipRef) => {
    change((current) => removeClip(current, ref));
    setSelected((current) => (sameRef(current, ref) ? null : current));
  };

  const split = (ref: ClipRef, timeMs: number) =>
    change((current) => splitClip(current, ref, timeMs, newId()));

  return {
    document,
    selected,
    select,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: () => setHistory(undoHistory),
    redo: () => setHistory(redoHistory),
    reset: (next: VideoDocument) => setHistory(historyOf(next)),
    addMain: (clip: MainClip) => {
      change((current) => addMainClip(current, clip));
      setSelected({ track: VideoTrack.Main, id: clip.id });
    },
    addOverlay: (clip: OverlayClip) => {
      change((current) => addOverlayClip(current, clip));
      setSelected({ track: VideoTrack.Overlay, id: clip.id });
    },
    addText: (clip: TextClip) => {
      change((current) => addTextClip(current, clip));
      setSelected({ track: VideoTrack.Text, id: clip.id });
    },
    addAudio: (clip: AudioClip) => {
      change((current) => addAudioClip(current, clip));
      setSelected({ track: VideoTrack.Audio, id: clip.id });
    },
    patchMain: (id: string, patch: Partial<MainClip>, mergeKey?: string) =>
      change((current) => patchMainClip(current, id, patch), mergeKey),
    patchOverlay: (id: string, patch: Partial<OverlayClip>, mergeKey?: string) =>
      change((current) => patchOverlayClip(current, id, patch), mergeKey),
    patchText: (id: string, patch: Partial<TextClip>, mergeKey?: string) =>
      change((current) => patchTextClip(current, id, patch), mergeKey),
    patchAudio: (id: string, patch: Partial<AudioClip>, mergeKey?: string) =>
      change((current) => patchAudioClip(current, id, patch), mergeKey),
    patchProject: (patch: ProjectPatch, mergeKey?: string) =>
      change((current) => ({ ...current, ...patch }), mergeKey),
    moveStart: (ref: ClipRef, startMs: number, mergeKey?: string) =>
      change((current) => setClipStart(current, ref, startMs), mergeKey),
    trim: (
      ref: ClipRef,
      edge: VideoTrimEdge,
      deltaMs: number,
      sourceDurationMs: number | null,
      base: VideoDocument,
      mergeKey: string,
    ) => change(() => trimClip(base, ref, edge, deltaMs, sourceDurationMs), mergeKey),
    reorder: (id: string, delta: number) => change((current) => moveMainClip(current, id, delta)),
    remove,
    split,
  };
};

export type VideoEditor = ReturnType<typeof useVideoEditor>;
