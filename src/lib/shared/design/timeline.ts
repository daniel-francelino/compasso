import { type History, redoHistory, undoHistory } from "@/lib/shared/design/history";
import type { DesignDocument } from "@/lib/shared/design/schemas";

const TIMELINE_DOCUMENT_LABEL = "Alteração";

export type PixelSteps = {
  undo: (stepId: string) => void;
  redo: (stepId: string) => void;
  busy: () => boolean;
};

export type TimelineStep = { label: string; applied: boolean; pixels: boolean };

type PixelMark = { label: string; stepId: string | null };

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

export const labelDocumentStep = (document: DesignDocument, label: string): void => {
  labels.set(document, { label, stepId: null });
};

export const inheritPixelStep = (from: DesignDocument, to: DesignDocument): DesignDocument => {
  const label = labels.get(from);
  if (label !== undefined) labels.set(to, label);
  return to;
};

const stepIdOf = (document: DesignDocument): string | null => labels.get(document)?.stepId ?? null;

export const isPixelStep = (document: DesignDocument): boolean => stepIdOf(document) !== null;

export const undoTimeline = (
  history: History<DesignDocument>,
  pixels: PixelSteps,
): History<DesignDocument> => {
  if (history.past.length === 0) return history;
  const stepId = stepIdOf(history.present);
  if (stepId !== null) pixels.undo(stepId);
  return undoHistory(history);
};

export const redoTimeline = (
  history: History<DesignDocument>,
  pixels: PixelSteps,
): History<DesignDocument> => {
  const next = history.future[0];
  if (next === undefined) return history;
  const stepId = stepIdOf(next);
  if (stepId !== null) pixels.redo(stepId);
  return redoHistory(history);
};

export const timelineSteps = (history: History<DesignDocument>): TimelineStep[] =>
  [...history.past, history.present, ...history.future].slice(1).map((document, index) => ({
    label: labels.get(document)?.label ?? TIMELINE_DOCUMENT_LABEL,
    applied: index < history.past.length,
    pixels: isPixelStep(document),
  }));

export const jumpTimeline = (
  history: History<DesignDocument>,
  pixels: PixelSteps,
  stepIndex: number,
): History<DesignDocument> => {
  const target = Math.max(0, Math.min(stepIndex + 1, history.past.length + history.future.length));
  let current = history;
  while (current.past.length !== target) {
    const before = current.past.length;
    current =
      current.past.length > target ? undoTimeline(current, pixels) : redoTimeline(current, pixels);
    if (current.past.length === before) break;
  }
  return current;
};
