import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "lost-ui/ui/tabs";
import { DESIGN_PANEL_LABEL, DesignPanel } from "@/lib/shared/design/types";

const ALL_PANELS = Object.values(DesignPanel);

const asPanel = (value: string): DesignPanel | undefined =>
  ALL_PANELS.find((panel) => panel === value);

export function DesignPanelDock({
  panels,
  tab,
  onTab,
}: {
  panels: Record<DesignPanel, ReactNode>;
  tab: DesignPanel;
  onTab: (tab: DesignPanel) => void;
}) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = asPanel(value);
        if (next !== undefined) onTab(next);
      }}
      className="flex min-h-0 flex-col"
    >
      <TabsList
        aria-label="Painéis"
        className="h-auto w-full shrink-0 justify-start overflow-x-auto rounded-none border-b bg-card p-0"
      >
        {ALL_PANELS.map((panel) => (
          <TabsTrigger
            key={panel}
            value={panel}
            className="min-h-11 rounded-none px-3 text-xs data-[state=active]:bg-accent data-[state=active]:shadow-none focus-visible:ring-inset"
          >
            {DESIGN_PANEL_LABEL[panel]}
          </TabsTrigger>
        ))}
      </TabsList>
      {ALL_PANELS.map((panel) => (
        <TabsContent key={panel} value={panel} className="mt-0 space-y-4 p-4">
          {panels[panel]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
