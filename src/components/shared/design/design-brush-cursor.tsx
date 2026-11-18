import { useSyncExternalStore } from "react";
import type { DesignViewport } from "@/hooks/shared/design/use-design-viewport";

export function DesignBrushCursor({
  viewport,
  diameter,
}: {
  viewport: DesignViewport;
  diameter: number;
}) {
  const point = useSyncExternalStore(viewport.cursor.subscribe, viewport.cursor.get, () => null);
  const view = viewport.view;
  if (point === null || view === null) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-full border border-foreground ring-1 ring-background"
      style={{
        width: diameter,
        height: diameter,
        left: view.x + point.x * view.zoom - diameter / 2,
        top: view.y + point.y * view.zoom - diameter / 2,
      }}
    />
  );
}
