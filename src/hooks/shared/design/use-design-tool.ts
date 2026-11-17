import { useState } from "react";
import { DesignTool } from "@/lib/shared/design/types";

export const useDesignTool = () => {
  const [tool, setTool] = useState<DesignTool>(DesignTool.Move);
  const [holding, setHolding] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  return {
    tool,
    active: holding ? DesignTool.Hand : tool,
    setTool,
    hold: setHolding,
    reset: () => setTool(DesignTool.Move),
    editingTextId,
    editText: setEditingTextId,
  };
};

export type DesignToolState = ReturnType<typeof useDesignTool>;
