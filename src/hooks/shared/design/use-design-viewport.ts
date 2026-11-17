import { useEffect, useMemo, useRef, useState } from "react";
import { DESIGN_LIMITS, type PageSize } from "@/lib/shared/design/types";
import {
  type Point,
  type Viewport,
  centeredViewport,
  fitViewport,
  panViewport,
  stepZoom,
  zoomAt,
} from "@/lib/shared/design/viewport";
import { createValueStore } from "@/lib/shared/value-store";

const EMPTY_AREA: PageSize = { width: 0, height: 0 };

export const useDesignViewport = (page: PageSize) => {
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<PageSize>(EMPTY_AREA);
  const [view, setView] = useState<Viewport | null>(null);
  const fitted = useRef(true);
  const cursor = useMemo(() => createValueStore<Point | null>(null), []);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    const measure = () => setArea({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (area.width === 0 || area.height === 0) return;
    setView((current) =>
      current === null || fitted.current
        ? fitViewport(page, area, DESIGN_LIMITS.viewPadding)
        : current,
    );
  }, [area, page]);

  const center = (): Point => ({ x: area.width / 2, y: area.height / 2 });

  const update = (next: (current: Viewport) => Viewport) => {
    fitted.current = false;
    setView((current) => (current === null ? current : next(current)));
  };

  return {
    ref,
    area,
    view,
    cursor,
    fit: () => {
      fitted.current = true;
      setView(fitViewport(page, area, DESIGN_LIMITS.viewPadding));
    },
    actualSize: () => {
      fitted.current = false;
      setView(centeredViewport(page, area, 1));
    },
    zoomTo: (zoom: number, point?: Point) =>
      update((current) => zoomAt(current, zoom, point ?? center())),
    zoomBy: (factor: number, point: Point) =>
      update((current) => zoomAt(current, current.zoom * factor, point)),
    step: (direction: 1 | -1, point?: Point) =>
      update((current) => zoomAt(current, stepZoom(current.zoom, direction), point ?? center())),
    pan: (dx: number, dy: number) => update((current) => panViewport(current, dx, dy)),
  };
};

export type DesignViewport = ReturnType<typeof useDesignViewport>;
