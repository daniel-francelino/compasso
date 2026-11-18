export class ImportTimeoutError extends Error {}

export class ImportAbortedError extends Error {}

export const errorName = (error: unknown): string =>
  error instanceof Error ? error.name : "unknown";

export const raceWithLimits = async <T>(
  work: Promise<T>,
  limits: { timeoutMs: number; signal?: AbortSignal | undefined },
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop: (reason: Error) => void = () => undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    stop = reject;
    timer = setTimeout(() => reject(new ImportTimeoutError()), limits.timeoutMs);
  });
  const onAbort = (): void => stop(new ImportAbortedError());
  limits.signal?.addEventListener("abort", onAbort, { once: true });
  work.catch(() => undefined);
  try {
    return await Promise.race([work, expiry]);
  } finally {
    clearTimeout(timer);
    limits.signal?.removeEventListener("abort", onAbort);
  }
};
