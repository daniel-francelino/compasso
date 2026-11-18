import { useState } from "react";
import {
  type BrushOptionKey,
  type BrushOptions,
  type BrushTool,
  DEFAULT_BRUSH_OPTIONS,
  DEFAULT_PRESSURE_OPTIONS,
  type PressureOptions,
  PaintSampleMode,
  adjustBrushByKey,
  withBrushOption,
} from "@/lib/shared/design/paint";
import { DesignTool } from "@/lib/shared/design/types";

type ByTool = Record<BrushTool, BrushOptions>;

const INITIAL: ByTool = {
  [DesignTool.Brush]: DEFAULT_BRUSH_OPTIONS,
  [DesignTool.Eraser]: { ...DEFAULT_BRUSH_OPTIONS, size: 60, hardness: 100 },
  [DesignTool.Clone]: { ...DEFAULT_BRUSH_OPTIONS, size: 60, hardness: 50 },
  [DesignTool.Dodge]: { ...DEFAULT_BRUSH_OPTIONS, size: 80, hardness: 30 },
  [DesignTool.Burn]: { ...DEFAULT_BRUSH_OPTIONS, size: 80, hardness: 30 },
};

export const useBrushOptions = () => {
  const [byTool, setByTool] = useState<ByTool>(INITIAL);
  const [pressure, setPressureState] = useState<PressureOptions>(DEFAULT_PRESSURE_OPTIONS);
  const [sample, setSample] = useState<PaintSampleMode>(PaintSampleMode.Layer);

  const adjustByKey = (tool: BrushTool, key: string, shift: boolean, code: string): boolean => {
    const next = adjustBrushByKey(byTool[tool], key, shift, code);
    if (next === null) return false;
    setByTool((current) => ({ ...current, [tool]: next }));
    return true;
  };

  return {
    optionsOf: (tool: BrushTool): BrushOptions => byTool[tool],
    setOption: (tool: BrushTool, key: BrushOptionKey, value: number) =>
      setByTool((current) => ({ ...current, [tool]: withBrushOption(current[tool], key, value) })),
    adjustByKey,
    pressure,
    setPressure: (patch: Partial<PressureOptions>) =>
      setPressureState((current) => ({ ...current, ...patch })),
    sample,
    setSample,
  };
};

export type BrushController = ReturnType<typeof useBrushOptions>;
