export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  mergeKey: string | null;
};

export const historyOf = <T>(present: T): History<T> => ({
  past: [],
  present,
  future: [],
  mergeKey: null,
});

export const pushHistory = <T>(
  history: History<T>,
  next: T,
  limit: number,
  mergeKey: string | null = null,
): History<T> => {
  if (next === history.present) return history;
  if (mergeKey !== null && mergeKey === history.mergeKey) {
    return { ...history, present: next, future: [] };
  }
  return {
    past: [...history.past, history.present].slice(-limit),
    present: next,
    future: [],
    mergeKey,
  };
};

export const undoHistory = <T>(history: History<T>): History<T> => {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    mergeKey: null,
  };
};

export const redoHistory = <T>(history: History<T>): History<T> => {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
    mergeKey: null,
  };
};

export const collapseHistory = <T>(
  history: History<T>,
  base: History<T>,
  limit: number,
): History<T> => {
  if (history.present === base.present) return base;
  return {
    past: [...base.past, base.present].slice(-limit),
    present: history.present,
    future: [],
    mergeKey: null,
  };
};
