import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Layer, Line, Rect, Stage, Transformer } from "react-konva";
import { DesignElementNode, type NodeEvents } from "@/components/shared/design/design-element-node";
import type { LoadedImages } from "@/hooks/shared/design/use-design-assets";
import type { CanvasChrome } from "@/lib/shared/design/browser";
import {
  type ElementPatch,
  type SnapTargets,
  boundsOf,
  snapBox,
  snapTargets,
} from "@/lib/shared/design/document";
import type { DesignElement, DesignPage } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignElementKind, type PageSize } from "@/lib/shared/design/types";

const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const SIDE_ANCHORS = ["middle-left", "middle-right"];
const ALL_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

type Guides = { xs: number[]; ys: number[] };
type DragSession = {
  key: string;
  starts: Map<string, { x: number; y: number }>;
  targets: SnapTargets;
};

const NO_GUIDES: Guides = { xs: [], ys: [] };

const patchOf = (element: DesignElement, node: Konva.Node): ElementPatch => {
  const width = Math.max(DESIGN_LIMITS.minSize, Math.round(element.width * node.scaleX()));
  const height =
    element.kind === DesignElementKind.Text
      ? element.height
      : Math.max(DESIGN_LIMITS.minSize, Math.round(element.height * node.scaleY()));
  node.scaleX(1);
  node.scaleY(1);
  return {
    id: element.id,
    patch: {
      x: Math.round(node.x() - width / 2),
      y: Math.round(node.y() - height / 2),
      width,
      height,
      rotation: node.rotation(),
    },
  };
};

export type DesignCanvasProps = {
  page: DesignPage;
  size: PageSize;
  scale: number;
  selectedIds: readonly string[];
  images: LoadedImages;
  chrome: CanvasChrome;
  fontsVersion: number;
  editable: boolean;
  interactive?: boolean;
  label: string;
  onSelect?: (id: string | null, additive: boolean) => void;
  onCommit?: (patches: ElementPatch[], mergeKey: string) => void;
  onMeasure?: (id: string, height: number) => void;
  onStage?: (stage: Konva.Stage | null) => void;
};

export default function DesignCanvas({
  page,
  size,
  scale,
  selectedIds,
  images,
  chrome,
  fontsVersion,
  editable,
  interactive = true,
  label,
  onSelect,
  onCommit,
  onMeasure,
  onStage,
}: DesignCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const session = useRef<DragSession | null>(null);
  const [guides, setGuides] = useState<Guides>(NO_GUIDES);
  const selected = page.elements.filter((element) => selectedIds.includes(element.id));
  const movable = editable ? selected.filter((element) => !element.locked) : [];
  const movableKey = movable.map((element) => element.id).join(",");
  const onlyText =
    movable.length > 0 && movable.every((element) => element.kind === DesignElementKind.Text);

  useEffect(() => {
    onStage?.(stageRef.current);
    return () => onStage?.(null);
  }, [onStage]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (transformer === null || stage === null) return;
    const ids = movableKey === "" ? [] : movableKey.split(",");
    const nodes = ids.flatMap((id) => {
      const node = stage.findOne(`#${id}`);
      return node === undefined ? [] : [node];
    });
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  });

  const commit = (patches: ElementPatch[], mergeKey: string) => onCommit?.(patches, mergeKey);

  const events: NodeEvents = {
    onPointer: (id, additive) => {
      if (!additive && selectedIds.includes(id)) return;
      onSelect?.(id, additive);
    },
    onDragStart: (id) => {
      const stage = stageRef.current;
      if (stage === null) return;
      const ids = selectedIds.includes(id) ? movable.map((element) => element.id) : [id];
      const starts = new Map<string, { x: number; y: number }>();
      for (const item of ids) {
        const node = stage.findOne(`#${item}`);
        if (node !== undefined) starts.set(item, { x: node.x(), y: node.y() });
      }
      session.current = {
        key: `drag:${crypto.randomUUID()}`,
        starts,
        targets: snapTargets(page, size, ids),
      };
    },
    onDragMove: (id, node) => {
      const current = session.current;
      const stage = stageRef.current;
      const origin = current?.starts.get(id);
      if (current === null || stage === null || origin === undefined) return;
      const dx = node.x() - origin.x;
      const dy = node.y() - origin.y;
      const moved = page.elements
        .filter((element) => current.starts.has(element.id))
        .map((element) => ({ ...element, x: element.x + dx, y: element.y + dy }));
      const box = boundsOf(moved);
      const snap =
        box === null
          ? { dx: 0, dy: 0, guidesX: [], guidesY: [] }
          : snapBox(box, current.targets, DESIGN_LIMITS.snapScreenPx / Math.max(scale, 0.01));
      for (const [item, start] of current.starts) {
        const target = item === id ? node : stage.findOne(`#${item}`);
        target?.position({ x: start.x + dx + snap.dx, y: start.y + dy + snap.dy });
      }
      setGuides({ xs: snap.guidesX, ys: snap.guidesY });
    },
    onDragEnd: () => {
      const current = session.current;
      const stage = stageRef.current;
      session.current = null;
      setGuides(NO_GUIDES);
      if (current === null || stage === null) return;
      const patches = page.elements.flatMap((element) => {
        const node = current.starts.has(element.id) ? stage.findOne(`#${element.id}`) : undefined;
        return node === undefined ? [] : [patchOf(element, node)];
      });
      commit(patches, current.key);
    },
    onMeasure: (id, height) => onMeasure?.(id, height),
  };

  const handleTransformEnd = () => {
    const transformer = transformerRef.current;
    if (transformer === null) return;
    const nodes = transformer.nodes();
    const patches = page.elements.flatMap((element) => {
      const node = nodes.find((item) => item.id() === element.id);
      return node === undefined ? [] : [patchOf(element, node)];
    });
    commit(patches, `transform:${crypto.randomUUID()}`);
  };

  const handleStagePointer = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.target === event.target.getStage() || event.target.name() === "page") {
      onSelect?.(null, false);
    }
  };

  return (
    <Stage
      ref={stageRef}
      width={Math.round(size.width * scale)}
      height={Math.round(size.height * scale)}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={handleStagePointer}
      onTouchStart={handleStagePointer}
      role="img"
      aria-label={label}
    >
      <Layer>
        <Rect
          name="page"
          width={size.width}
          height={size.height}
          {...(page.background === null ? {} : { fill: page.background })}
        />
        {page.elements.map((element) => (
          <DesignElementNode
            key={element.id}
            element={element}
            image={
              element.kind === DesignElementKind.Image
                ? images.get(element.mediaVersionId)
                : undefined
            }
            chrome={chrome}
            fontsVersion={fontsVersion}
            interactive={interactive}
            events={events}
          />
        ))}
        {interactive ? (
          <Transformer
            ref={transformerRef}
            rotateEnabled={movable.length > 0}
            enabledAnchors={onlyText ? SIDE_ANCHORS : ALL_ANCHORS}
            keepRatio={movable.some((element) => element.kind === DesignElementKind.Image)}
            rotationSnaps={ROTATION_SNAPS}
            anchorStroke={chrome.accent}
            anchorFill={chrome.surface}
            borderStroke={chrome.accent}
            anchorSize={12}
            onTransformEnd={handleTransformEnd}
            boundBoxFunc={(oldBox, newBox) =>
              Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4 ? oldBox : newBox
            }
          />
        ) : null}
      </Layer>
      {interactive ? (
        <Layer listening={false}>
          {guides.xs.map((x) => (
            <Line
              key={`x${x}`}
              points={[x, 0, x, size.height]}
              stroke={chrome.accent}
              strokeWidth={1 / Math.max(scale, 0.01)}
              dash={[6 / scale, 4 / scale]}
            />
          ))}
          {guides.ys.map((y) => (
            <Line
              key={`y${y}`}
              points={[0, y, size.width, y]}
              stroke={chrome.accent}
              strokeWidth={1 / Math.max(scale, 0.01)}
              dash={[6 / scale, 4 / scale]}
            />
          ))}
        </Layer>
      ) : null}
    </Stage>
  );
}
