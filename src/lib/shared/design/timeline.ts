import { type History, redoHistory, undoHistory } from "@/lib/shared/design/history";
import type { DesignDocument } from "@/lib/shared/design/schemas";

const TIMELINE_DOCUMENT_LABEL = "Alteração";

export type PixelSteps = {
  undo: (stepId: string) => void;
  redo: (stepId: string) => void;
  busy: () => boolean;
};

export type TimelineStep = { label: string; applied: boolean; pixels: boolean };

type PixelMark = { label: string; stepId: string };

const labels = new WeakMap<DesignDocument, PixelMark>();

export const markPixelStep = (
  document: DesignDocument,
  label: string,
  stepId: string,
): DesignDocument => {
  const marked = { ...document };
  labels.set(marked, { label, stepId });
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
  const mark = labels.get(history.present);
  if (mark !== undefined) pixels.undo(mark.stepId);
  return undoHistory(history);
};

export const redoTimeline = (
  history: History<DesignDocument>,
  pixels: PixelSteps,
): History<DesignDocument> => {
  const next = history.future[0];
  if (next === undefined) return history;
  const mark = labels.get(next);
  if (mark !== undefined) pixels.redo(mark.stepId);
  return redoHistory(history);
};

export const timelineSteps = (history: History<DesignDocument>): TimelineStep[] =>
  [...history.past, history.present, ...history.future].slice(1).map((document, index) => ({
    label: labels.get(document)?.label ?? TIMELINE_DOCUMENT_LABEL,
    applied: index < history.past.length,
    pixels: labels.has(document),
  }));
