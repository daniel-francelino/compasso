import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { z } from "zod";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shared/ui/collapsible";
import { DESIGN_PANEL_LABEL, DesignPanel } from "@/lib/shared/design/types";
import { StoredKey, readStored, writeStored } from "@/lib/shared/stored-keys";
import { cn } from "@/lib/shared/utils";

const ALL_PANELS = Object.values(DesignPanel);
const openPanelsSchema = z.array(z.nativeEnum(DesignPanel));

export function DesignPanelDock({ panels }: { panels: Record<DesignPanel, ReactNode> }) {
  const [open, setOpen] = useState<DesignPanel[]>(ALL_PANELS);

  useEffect(() => {
    setOpen(readStored(StoredKey.DesignPanels, openPanelsSchema, ALL_PANELS));
  }, []);

  const toggle = (panel: DesignPanel, next: boolean) => {
    const updated = next ? [...open, panel] : open.filter((item) => item !== panel);
    setOpen(updated);
    writeStored(StoredKey.DesignPanels, updated);
  };

  return (
    <div className="divide-y">
      {ALL_PANELS.map((panel) => {
        const expanded = open.includes(panel);
        return (
          <Collapsible key={panel} open={expanded} onOpenChange={(next) => toggle(panel, next)}>
            <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring">
              {DESIGN_PANEL_LABEL[panel]}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-4 text-muted-foreground motion-safe:transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-1">{panels[panel]}</CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
