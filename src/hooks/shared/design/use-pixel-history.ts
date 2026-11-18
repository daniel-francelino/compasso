import { useRef, useState } from "react";
import { createPixelHistory } from "@/lib/shared/design/raster/pixel-history";
import type { RasterStore } from "@/lib/shared/design/raster-store";
import type { PixelSteps } from "@/lib/shared/design/timeline";

export const usePixelHistory = () => {
  const [history] = useState(() => createPixelHistory());
  const store = useRef<RasterStore | null>(null);
  const stroking = useRef(false);

  const [steps] = useState<PixelSteps>(() => {
    const resolve = (id: string) => store.current?.get(id) ?? null;
    return {
      busy: () => stroking.current,
      has: (stepId: string) => history.steps().some((item) => item.id === stepId),
      undo: (stepId: string) => {
        const step = history
          .steps()
          .filter((item) => item.applied)
          .at(-1);
        if (step === undefined || history.undo(resolve, stepId) === null) return false;
        store.current?.markChanged(step.targetId);
        return true;
      },
      redo: (stepId: string) => {
        const step = history.steps().find((item) => !item.applied);
        if (step === undefined || history.redo(resolve, stepId) === null) return false;
        store.current?.markChanged(step.targetId);
        return true;
      },
    };
  });

  return {
    history,
    steps,
    stroking,
    bind: (next: RasterStore) => {
      store.current = next;
    },
  };
};

export type PixelHistorySession = ReturnType<typeof usePixelHistory>;
