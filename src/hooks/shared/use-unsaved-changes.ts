import { createContext, useContext, useEffect, useMemo } from "react";

type GuardContextValue = {
  hasUnsaved: boolean;
  setDirty: (id: symbol, dirty: boolean) => void;
  confirmDiscard: () => Promise<boolean>;
};

export const GuardContext = createContext<GuardContextValue | null>(null);

export function useUnsavedChanges(dirty: boolean) {
  const context = useContext(GuardContext);
  if (!context)
    throw new Error("useUnsavedChanges precisa estar dentro de UnsavedChangesProvider.");

  const id = useMemo(() => Symbol("unsaved-changes"), []);
  useEffect(() => {
    context.setDirty(id, dirty);
    return () => context.setDirty(id, false);
  }, [context, dirty, id]);

  return dirty ? context.confirmDiscard : async () => true;
}

export function useHasUnsavedChanges(): boolean {
  return useContext(GuardContext)?.hasUnsaved ?? false;
}
