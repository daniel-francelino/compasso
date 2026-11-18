import { Group, Line, Rect } from "react-konva";
import type { CanvasChrome } from "@/lib/shared/design/browser";
import { type CropBox, cropHandlePoints } from "@/lib/shared/design/crop";
import type { PageSize } from "@/lib/shared/design/types";

const DIM_OPACITY = 0.5;
const HANDLE_SCREEN_PX = 10;

export function DesignCropOverlay({
  box,
  size,
  chrome,
  scale,
  fixedRatio,
}: {
  box: CropBox;
  size: PageSize;
  chrome: CanvasChrome;
  scale: number;
  fixedRatio: boolean;
}) {
  const unit = 1 / Math.max(scale, 0.01);
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const handle = HANDLE_SCREEN_PX * unit;
  const thirdsX = [box.x + box.width / 3, box.x + (box.width * 2) / 3];
  const thirdsY = [box.y + box.height / 3, box.y + (box.height * 2) / 3];
  const dim = { fill: chrome.ink, opacity: DIM_OPACITY, listening: false };
  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={size.width} height={box.y} {...dim} />
      <Rect x={0} y={bottom} width={size.width} height={size.height - bottom} {...dim} />
      <Rect x={0} y={box.y} width={box.x} height={box.height} {...dim} />
      <Rect x={right} y={box.y} width={size.width - right} height={box.height} {...dim} />
      {thirdsX.map((x) => (
        <Line
          key={`x${x}`}
          points={[x, box.y, x, bottom]}
          stroke={chrome.surface}
          strokeWidth={unit}
          opacity={0.6}
        />
      ))}
      {thirdsY.map((y) => (
        <Line
          key={`y${y}`}
          points={[box.x, y, right, y]}
          stroke={chrome.surface}
          strokeWidth={unit}
          opacity={0.6}
        />
      ))}
      <Rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        stroke={chrome.surface}
        strokeWidth={2 * unit}
      />
      {cropHandlePoints(box, fixedRatio).map(([name, at]) => (
        <Rect
          key={name}
          x={at.x - handle / 2}
          y={at.y - handle / 2}
          width={handle}
          height={handle}
          fill={chrome.surface}
          stroke={chrome.accent}
          strokeWidth={unit}
        />
      ))}
    </Group>
  );
}
