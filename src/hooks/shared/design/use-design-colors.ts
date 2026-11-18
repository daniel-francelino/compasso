import { useState } from "react";
import type { CanvasChrome } from "@/lib/shared/design/browser";

type Chosen = { foreground: string | null; background: string | null };

export const useDesignColors = (chrome: CanvasChrome | null) => {
  const [chosen, setChosen] = useState<Chosen>({ foreground: null, background: null });
  const foreground = chosen.foreground ?? chrome?.ink ?? null;
  const background = chosen.background ?? chrome?.surface ?? null;

  return {
    foreground,
    background,
    setForeground: (color: string) => setChosen((current) => ({ ...current, foreground: color })),
    setBackground: (color: string) => setChosen((current) => ({ ...current, background: color })),
    swap: () => setChosen({ foreground: background, background: foreground }),
    reset: () => setChosen({ foreground: null, background: null }),
  };
};

export type DesignColors = ReturnType<typeof useDesignColors>;
