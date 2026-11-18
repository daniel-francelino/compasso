import { useState } from "react";
import { DesignTool, isShapeTool } from "@/lib/shared/design/types";

export const useDesignTool = () => {
  const [tool, setToolState] = useState<DesignTool>(DesignTool.Move);
  const [lastShape, setLastShape] = useState<DesignTool>(DesignTool.Rect);
  const [holding, setHolding] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const setTool = (next: DesignTool) => {
    if (isShapeTool(next)) setLastShape(next);
    setToolState(next);
  };

  return {
    tool,
    lastShape,
    active: holding ? DesignTool.Hand : tool,
    setTool,
    hold: setHolding,
    reset: () => setToolState(DesignTool.Move),
    editingTextId,
    editText: setEditingTextId,
  };
};

export type DesignToolState = ReturnType<typeof useDesignTool>;
