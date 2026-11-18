import { useState } from "react";
import {
  type BrushOptionKey,
  type BrushOptions,
  type BrushTool,
  DEFAULT_BRUSH_OPTIONS,
  PaintSampleMode,
  adjustBrushByKey,
  withBrushOption,
} from "@/lib/shared/design/paint";
import { DesignTool } from "@/lib/shared/design/types";

type ByTool = Record<BrushTool, BrushOptions>;

const INITIAL: ByTool = {
  [DesignTool.Brush]: DEFAULT_BRUSH_OPTIONS,
  [DesignTool.Eraser]: { ...DEFAULT_BRUSH_OPTIONS, size: 60, hardness: 100 },
};

export const useBrushOptions = () => {
  const [byTool, setByTool] = useState<ByTool>(INITIAL);
  const [sample, setSample] = useState<PaintSampleMode>(PaintSampleMode.Layer);

  const adjustByKey = (tool: BrushTool, key: string, shift: boolean): boolean => {
    const next = adjustBrushByKey(byTool[tool], key, shift);
    if (next === null) return false;
    setByTool((current) => ({ ...current, [tool]: next }));
    return true;
  };

  return {
    optionsOf: (tool: BrushTool): BrushOptions => byTool[tool],
    setOption: (tool: BrushTool, key: BrushOptionKey, value: number) =>
      setByTool((current) => ({ ...current, [tool]: withBrushOption(current[tool], key, value) })),
    adjustByKey,
    sample,
    setSample,
  };
};

export type BrushController = ReturnType<typeof useBrushOptions>;
