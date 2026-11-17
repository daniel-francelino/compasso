import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { ErrorCode } from "@/lib/shared/auth/errors";
import { saveDesignDraft } from "@/lib/shared/design/design.functions";
import { isTooLarge } from "@/lib/shared/design/document";
import type { DesignDocument } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignSaveState } from "@/lib/shared/design/types";
import type { Result } from "@/lib/shared/server-utils";

const TOO_LARGE = "Este design ficou grande demais. Remova alguns elementos para salvar.";
const OFFLINE =
  "Não foi possível salvar. Verifique sua conexão; tentaremos de novo na próxima alteração.";

export const useDesignAutosave = ({
  designId,
  document,
  initialVersion,
  enabled,
}: {
  designId: string;
  document: DesignDocument;
  initialVersion: number;
  enabled: boolean;
}) => {
  const [state, setState] = useState<DesignSaveState>(DesignSaveState.Saved);
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const version = useRef(initialVersion);
  const saved = useRef(document);
  const latest = useRef(document);
  const running = useRef<Promise<boolean> | null>(null);
  latest.current = document;

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
    if (isTooLarge(target)) {
      fail({ code: ErrorCode.Invalid, message: TOO_LARGE });
      return false;
    }
    setState(DesignSaveState.Saving);
    try {
      const result = await saveDesignDraft({
        data: { id: designId, document: target, expectedVersion: version.current },
      });
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
    const timer = window.setTimeout(() => void flushRef.current(), DESIGN_LIMITS.autosaveMs);
    return () => window.clearTimeout(timer);
  }, [document, enabled, blocked, tick]);

  const reportActionFailure = (failure: { code: string; message: string }) => {
    if (failure.code === ErrorCode.Conflict) fail(failure);
    toast.error(failure.message);
  };

  const withVersion = async <T extends { version: number }>(
    action: (expectedVersion: number) => Promise<Result<T>>,
  ): Promise<Result<T> | null> => {
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
