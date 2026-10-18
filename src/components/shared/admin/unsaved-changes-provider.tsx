import { useBlocker } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { consumeBypass } from "@/lib/shared/unsaved-guard";
import { GuardContext } from "@/hooks/shared/use-unsaved-changes";

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [dirtyIds, setDirtyIds] = useState<Set<symbol>>(() => new Set());
  const [manualConfirm, setManualConfirm] = useState<((confirmed: boolean) => void) | null>(null);
  const handledPrompt = useRef(false);
  const blocked = useBlocker({
    shouldBlockFn: () => {
      if (consumeBypass()) return false;
      return dirtyIds.size > 0;
    },
    withResolver: true,
    enableBeforeUnload: () => dirtyIds.size > 0,
  });

  const setDirty = useCallback((id: symbol, dirty: boolean) => {
    setDirtyIds((current) => {
      if (current.has(id) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const confirmDiscard = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        setManualConfirm(() => resolve);
      }),
    [],
  );

  const hasUnsaved = dirtyIds.size > 0;
  const contextValue = useMemo(
    () => ({ hasUnsaved, setDirty, confirmDiscard }),
    [hasUnsaved, setDirty, confirmDiscard],
  );
  const routerBlocked = blocked.status === "blocked";

  function closePrompt(confirmed: boolean) {
    if (confirmed) handledPrompt.current = true;
    if (routerBlocked && confirmed) blocked.proceed();
    if (routerBlocked && !confirmed) blocked.reset();
    if (manualConfirm) {
      manualConfirm(confirmed);
      setManualConfirm(null);
    }
  }

  return (
    <GuardContext.Provider value={contextValue}>
      {children}
      <ConfirmDialog
        open={routerBlocked || manualConfirm !== null}
        onOpenChange={(open) => {
          if (open) return;
          if (handledPrompt.current) {
            handledPrompt.current = false;
            return;
          }
          closePrompt(false);
        }}
        title="Sair sem salvar?"
        description="Tem alterações por salvar. Se sair agora, essas alterações serão perdidas."
        confirmLabel="Sair sem salvar"
        onConfirm={() => {
          closePrompt(true);
          return true;
        }}
      />
    </GuardContext.Provider>
  );
}
