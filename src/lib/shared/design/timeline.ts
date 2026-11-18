import { type History, redoHistory, undoHistory } from "@/lib/shared/design/history";
import type { DesignDocument } from "@/lib/shared/design/schemas";

export const TIMELINE_DOCUMENT_LABEL = "Alteração";

export type PixelSteps = { undo: () => void; redo: () => void };

export type TimelineStep = { label: string; applied: boolean; pixels: boolean };

const labels = new WeakMap<DesignDocument, string>();

export const markPixelStep = (document: DesignDocument, label: string): DesignDocument => {
  const marked = { ...document };
  labels.set(marked, label);
  return marked;
};

export const inheritPixelStep = (from: DesignDocument, to: DesignDocument): DesignDocument => {
  const label = labels.get(from);
  if (label !== undefined) labels.set(to, label);
  return to;
};

export const isPixelStep = (document: DesignDocument): boolean => labels.has(document);

export const undoTimeline = (
  history: History<DesignDocument>,
  pixels: PixelSteps,
): History<DesignDocument> => {
  if (history.past.length === 0) return history;
  if (isPixelStep(history.present)) pixels.undo();
  return undoHistory(history);
};

export const redoTimeline = (
  history: History<DesignDocument>,
  pixels: PixelSteps,
): History<DesignDocument> => {
  const next = history.future[0];
  if (next === undefined) return history;
  if (isPixelStep(next)) pixels.redo();
  return redoHistory(history);
};

export const timelineSteps = (history: History<DesignDocument>): TimelineStep[] =>
  [...history.past, history.present, ...history.future].slice(1).map((document, index) => ({
    label: labels.get(document) ?? TIMELINE_DOCUMENT_LABEL,
    applied: index < history.past.length,
    pixels: labels.has(document),
  }));
