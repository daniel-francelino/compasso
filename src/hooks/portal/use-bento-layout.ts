import { useEffect, useState } from "react";
import { columnCountFor, columnWidthFor, packBento } from "@/lib/portal/approvals/bento";

export const useBentoLayout = <T>(
  items: readonly T[],
  heightOf: (item: T, columnWidth: number) => number,
) => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (element === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  const columns = columnCountFor(width);
  const columnWidth = columnWidthFor(width, columns);
  const lanes = packBento(items, columns, (item) => heightOf(item, columnWidth));

  return { containerRef: setElement, lanes };
};
