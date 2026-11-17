import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { ErrorCode } from "@/lib/shared/auth/errors";
import { DesignSaveState } from "@/lib/shared/design/types";
import type { Result } from "@/lib/shared/server-utils";

const OFFLINE =
  "Não foi possível salvar. Verifique sua conexão; tentaremos de novo na próxima alteração.";

export type DraftAutosaveOptions<T> = {
  document: T;
  initialVersion: number;
  enabled: boolean;
  delayMs: number;
  tooLarge: (document: T) => string | null;
  save: (document: T, expectedVersion: number) => Promise<Result<{ version: number }>>;
};

export const useDraftAutosave = <T>({
  document,
  initialVersion,
  enabled,
  delayMs,
  tooLarge,
  save,
}: DraftAutosaveOptions<T>) => {
  const [state, setState] = useState<DesignSaveState>(DesignSaveState.Saved);
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const version = useRef(initialVersion);
  const saved = useRef(document);
  const latest = useRef(document);
  const running = useRef<Promise<boolean> | null>(null);
  const handlers = useRef({ tooLarge, save });
  latest.current = document;
  handlers.current = { tooLarge, save };

  const blocked = state === DesignSaveState.Conflict;

  const fail = (failure: { code: string; message: string }) => {
    setMessage(failure.message);
    setState(
      failure.code === ErrorCode.Conflict ? DesignSaveState.Conflict : DesignSaveState.Failed,
    );
  };

  const saveNow = async (): Promise<boolean> => {
    const target = latest.current;
    if (target === saved.current) return true;
    const tooLargeMessage = handlers.current.tooLarge(target);
    if (tooLargeMessage !== null) {
      fail({ code: ErrorCode.Invalid, message: tooLargeMessage });
      return false;
    }
    setState(DesignSaveState.Saving);
    try {
      const result = await handlers.current.save(target, version.current);
      if (!result.ok) {
        fail(result);
        return false;
      }
      version.current = result.version;
      saved.current = target;
      setMessage(null);
      setState(latest.current === target ? DesignSaveState.Saved : DesignSaveState.Pending);
      setTick((value) => value + 1);
      return true;
    } catch {
      fail({ code: ErrorCode.Unavailable, message: OFFLINE });
      return false;
    }
  };

  const flush = (): Promise<boolean> => {
    const next = (running.current ?? Promise.resolve(true)).then(saveNow);
    running.current = next;
    return next;
  };

  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    if (!enabled || blocked || document === saved.current) return undefined;
    setState((current) => (current === DesignSaveState.Saving ? current : DesignSaveState.Pending));
    const timer = window.setTimeout(() => void flushRef.current(), delayMs);
    return () => window.clearTimeout(timer);
  }, [document, enabled, blocked, tick, delayMs]);

  const reportActionFailure = (failure: { code: string; message: string }) => {
    if (failure.code === ErrorCode.Conflict) fail(failure);
    toast.error(failure.message);
  };

  const withVersion = async <R extends { version: number }>(
    action: (expectedVersion: number) => Promise<Result<R>>,
  ): Promise<Result<R> | null> => {
    if (blocked) return null;
    const flushed = await flush();
    if (!flushed) return null;
    const result = await action(version.current);
    if (!result.ok) {
      reportActionFailure(result);
      return result;
    }
    version.current = result.version;
    return result;
  };

  useUnsavedChanges(enabled && state !== DesignSaveState.Saved);

  return { state, message, flush, withVersion };
};
