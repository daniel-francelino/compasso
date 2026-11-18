import { useEffect, useState } from "react";
import { z } from "zod";
import { DesignPanel } from "@/lib/shared/design/types";
import { StoredKey, readStored, writeStored } from "@/lib/shared/stored-keys";

const tabSchema = z.nativeEnum(DesignPanel);

export const useDesignPanelTab = () => {
  const [tab, setTabState] = useState<DesignPanel>(DesignPanel.Layers);

  useEffect(() => {
    setTabState(readStored(StoredKey.DesignPanelTab, tabSchema, DesignPanel.Layers));
  }, []);

  const setTab = (next: DesignPanel) => {
    setTabState(next);
    writeStored(StoredKey.DesignPanelTab, next);
  };

  return { tab, setTab };
};

export type DesignPanelTabState = ReturnType<typeof useDesignPanelTab>;
