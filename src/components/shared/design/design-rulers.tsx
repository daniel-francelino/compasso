import { useSyncExternalStore } from "react";
import type { DesignViewport } from "@/hooks/shared/design/use-design-viewport";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import { rulerTicks } from "@/lib/shared/design/viewport";

const SIZE = DESIGN_LIMITS.rulerSize;

function Ruler({
  vertical,
  offset,
  zoom,
  length,
  marker,
}: {
  vertical: boolean;
  offset: number;
  zoom: number;
  length: number;
  marker: number | null;
}) {
  const ticks = rulerTicks(offset, zoom, length);
  const width = vertical ? SIZE : length;
  const height = vertical ? length : SIZE;
  return (
    <svg width={width} height={height} className="block text-muted-foreground" aria-hidden="true">
      {ticks.map((tick) =>
        vertical ? (
          <g key={tick.value}>
            <line x1={SIZE - 8} x2={SIZE} y1={tick.at} y2={tick.at} stroke="currentColor" />
            <text
              x={SIZE - 10}
              y={tick.at + 3}
              fontSize={9}
              fill="currentColor"
              textAnchor="end"
              transform={`rotate(-90 ${SIZE - 10} ${tick.at + 3})`}
            >
              {tick.value}
            </text>
          </g>
        ) : (
          <g key={tick.value}>
            <line x1={tick.at} x2={tick.at} y1={SIZE - 8} y2={SIZE} stroke="currentColor" />
            <text x={tick.at + 3} y={SIZE - 10} fontSize={9} fill="currentColor">
              {tick.value}
            </text>
          </g>
        ),
      )}
      {marker === null ? null : (
        <line
          className="text-primary"
          stroke="currentColor"
          {...(vertical
            ? { x1: 0, x2: SIZE, y1: marker, y2: marker }
            : { x1: marker, x2: marker, y1: 0, y2: SIZE })}
        />
      )}
    </svg>
  );
}

export function DesignRulers({ viewport }: { viewport: DesignViewport }) {
  const point = useSyncExternalStore(viewport.cursor.subscribe, viewport.cursor.get, () => null);
  const view = viewport.view;
  if (view === null) return null;
  return (
    <>
      <div className="col-start-2 row-start-1 overflow-hidden border-b bg-card">
        <Ruler
          vertical={false}
          offset={view.x}
          zoom={view.zoom}
          length={viewport.area.width}
          marker={point === null ? null : view.x + point.x * view.zoom}
        />
      </div>
      <div className="col-start-1 row-start-2 overflow-hidden border-r bg-card">
        <Ruler
          vertical
          offset={view.y}
          zoom={view.zoom}
          length={viewport.area.height}
          marker={point === null ? null : view.y + point.y * view.zoom}
        />
      </div>
    </>
  );
}
