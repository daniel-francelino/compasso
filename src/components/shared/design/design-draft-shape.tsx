import { Ellipse, Line, Rect } from "react-konva";
import type { CanvasDraft } from "@/hooks/shared/design/use-canvas-gestures";
import { DesignTool } from "@/lib/shared/design/types";
import { boxFromPoints, snapAngle } from "@/lib/shared/design/viewport";

export function DesignDraftShape({
  draft,
  scale,
  color,
}: {
  draft: CanvasDraft;
  scale: number;
  color: string;
}) {
  const strokeWidth = 1 / Math.max(scale, 0.01);
  const dash = [6 / scale, 4 / scale];
  if (draft.kind === "draw" && draft.tool === DesignTool.Line) {
    const end = draft.shift ? snapAngle(draft.start, draft.end) : draft.end;
    return (
      <Line
        points={[draft.start.x, draft.start.y, end.x, end.y]}
        stroke={color}
        strokeWidth={strokeWidth * 2}
      />
    );
  }
  const square = draft.kind === "draw" && draft.shift;
  const box = boxFromPoints(draft.start, draft.end, square);
  if (draft.kind === "draw" && draft.tool === DesignTool.Ellipse) {
    return (
      <Ellipse
        x={box.x + box.width / 2}
        y={box.y + box.height / 2}
        radiusX={box.width / 2}
        radiusY={box.height / 2}
        stroke={color}
        strokeWidth={strokeWidth}
        dash={dash}
      />
    );
  }
  return <Rect {...box} stroke={color} strokeWidth={strokeWidth} dash={dash} />;
}
