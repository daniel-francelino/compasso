import Konva from "konva";
import { useEffect, useRef } from "react";
import { Ellipse, Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";
import type { CanvasChrome } from "@/lib/shared/design/browser";
import { canvasBlendOperation, coverCrop, isRendered } from "@/lib/shared/design/document";
import type {
  DesignElement,
  ImageElement,
  LineElement,
  RasterElement,
  TextElement,
} from "@/lib/shared/design/schemas";
import {
  DESIGN_LIMITS,
  DesignElementKind,
  DesignFont,
  designFontFamily,
} from "@/lib/shared/design/types";

export type NodeEvents = {
  onPointer: (id: string, additive: boolean) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, node: Konva.Node) => void;
  onDragEnd: () => void;
  onMeasure: (id: string, height: number) => void;
  onEdit: (id: string) => void;
};

type NodeProps = {
  element: DesignElement;
  image: HTMLImageElement | null | undefined;
  raster?: HTMLCanvasElement | null | undefined;
  chrome: CanvasChrome;
  fontsVersion: number;
  interactive: boolean;
  hidden?: boolean;
  events: NodeEvents;
};

const fontStyle = (element: TextElement) =>
  [element.italic ? "italic" : "", element.bold ? "bold" : ""].join(" ").trim() || "normal";

function TextBody({
  element,
  fontsVersion,
  onMeasure,
}: {
  element: TextElement;
  fontsVersion: number;
  onMeasure: (id: string, height: number) => void;
}) {
  const ref = useRef<Konva.Text>(null);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const height = Math.max(DESIGN_LIMITS.minSize, Math.round(node.height()));
    if (Math.abs(height - element.height) >= 1) onMeasure(element.id, height);
  });

  const shadow = element.shadow;
  return (
    <Text
      key={fontsVersion}
      ref={ref}
      text={element.text}
      width={element.width}
      fontFamily={designFontFamily(element.font)}
      fontStyle={fontStyle(element)}
      fontSize={element.fontSize}
      fill={element.color}
      align={element.align}
      lineHeight={element.lineHeight}
      wrap="word"
      shadowEnabled={shadow !== null}
      {...(shadow === null
        ? {}
        : {
            shadowColor: shadow.color,
            shadowBlur: shadow.blur,
            shadowOffsetX: shadow.offsetX,
            shadowOffsetY: shadow.offsetY,
            shadowOpacity: 1,
          })}
    />
  );
}

function ImagePlaceholder({
  element,
  chrome,
  missing,
}: {
  element: ImageElement;
  chrome: CanvasChrome;
  missing: boolean;
}) {
  return (
    <>
      <Rect
        width={element.width}
        height={element.height}
        fill={chrome.surface}
        stroke={chrome.line}
        dash={[12, 8]}
        strokeWidth={2}
      />
      <Text
        width={element.width}
        height={element.height}
        align="center"
        verticalAlign="middle"
        text={missing ? "Imagem indisponível" : "Carregando imagem…"}
        fontFamily={designFontFamily(DesignFont.DmSans)}
        fontSize={Math.max(12, Math.min(32, element.width / 12))}
        fill={chrome.ink}
      />
    </>
  );
}

function ImageBody({
  element,
  image,
  chrome,
}: {
  element: ImageElement;
  image: HTMLImageElement | null | undefined;
  chrome: CanvasChrome;
}) {
  const ref = useRef<Konva.Image>(null);
  const filtered = element.brightness !== 0 || element.contrast !== 0;

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (!filtered) {
      node.clearCache();
      return;
    }
    node.cache();
    node.getLayer()?.batchDraw();
  });

  if (image === null || image === undefined) {
    return <ImagePlaceholder element={element} chrome={chrome} missing={image === null} />;
  }
  const crop = coverCrop(
    { width: image.naturalWidth, height: image.naturalHeight },
    { width: element.width, height: element.height },
    element.zoom,
    element.focusX,
    element.focusY,
  );
  return (
    <KonvaImage
      ref={ref}
      image={image}
      crop={crop}
      width={element.width}
      height={element.height}
      x={element.flipX ? element.width : 0}
      y={element.flipY ? element.height : 0}
      scaleX={element.flipX ? -1 : 1}
      scaleY={element.flipY ? -1 : 1}
      filters={filtered ? [Konva.Filters.Brighten, Konva.Filters.Contrast] : []}
      brightness={element.brightness}
      contrast={element.contrast}
    />
  );
}

function RasterBody({
  element,
  canvas,
}: {
  element: RasterElement;
  canvas: HTMLCanvasElement | null | undefined;
}) {
  return (
    <>
      <Rect width={element.width} height={element.height} fill="transparent" />
      {canvas === null || canvas === undefined ? null : (
        <KonvaImage image={canvas} width={element.width} height={element.height} />
      )}
    </>
  );
}

function LineBody({ element }: { element: LineElement }) {
  const middle = element.height / 2;
  return (
    <>
      <Rect width={element.width} height={element.height} fill="transparent" />
      <Line
        points={[0, middle, element.width, middle]}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        lineCap="round"
        dash={element.dashed ? [element.strokeWidth * 3, element.strokeWidth * 2] : []}
      />
    </>
  );
}

function ElementBody({
  element,
  image,
  raster,
  chrome,
  fontsVersion,
  onMeasure,
}: Pick<NodeProps, "element" | "image" | "raster" | "chrome" | "fontsVersion"> & {
  onMeasure: NodeEvents["onMeasure"];
}) {
  if (element.kind === DesignElementKind.Text) {
    return <TextBody element={element} fontsVersion={fontsVersion} onMeasure={onMeasure} />;
  }
  if (element.kind === DesignElementKind.Image) {
    return <ImageBody element={element} image={image} chrome={chrome} />;
  }
  if (element.kind === DesignElementKind.Line) return <LineBody element={element} />;
  if (element.kind === DesignElementKind.Raster) {
    return <RasterBody element={element} canvas={raster} />;
  }
  if (element.kind === DesignElementKind.Adjustment || element.kind === DesignElementKind.Group) {
    return null;
  }
  if (element.kind === DesignElementKind.Rect) {
    return (
      <Rect
        width={element.width}
        height={element.height}
        fill={element.fill}
        cornerRadius={element.cornerRadius}
      />
    );
  }
  return (
    <Ellipse
      x={element.width / 2}
      y={element.height / 2}
      radiusX={element.width / 2}
      radiusY={element.height / 2}
      fill={element.fill}
    />
  );
}

export function DesignElementNode({
  element,
  image,
  raster,
  chrome,
  fontsVersion,
  interactive,
  hidden = false,
  events,
}: NodeProps) {
  if (!isRendered(element) || element.kind === DesignElementKind.Adjustment) return null;
  if (element.kind === DesignElementKind.Group) return null;
  const edit = () => {
    if (element.kind === DesignElementKind.Text && !element.locked) events.onEdit(element.id);
  };
  const movable = interactive && !element.locked;
  const halfWidth = element.width / 2;
  const halfHeight = element.height / 2;

  return (
    <Group
      id={element.id}
      name="design-element"
      x={element.x + halfWidth}
      y={element.y + halfHeight}
      offsetX={halfWidth}
      offsetY={halfHeight}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={hidden ? 0 : element.opacity}
      globalCompositeOperation={canvasBlendOperation(element.blendMode)}
      draggable={movable}
      listening={interactive}
      onMouseDown={(event) => events.onPointer(element.id, event.evt.shiftKey)}
      onTap={() => events.onPointer(element.id, false)}
      onDblClick={edit}
      onDblTap={edit}
      onDragStart={() => events.onDragStart(element.id)}
      onDragMove={(event) => events.onDragMove(element.id, event.target)}
      onDragEnd={events.onDragEnd}
    >
      <Group opacity={element.fillOpacity}>
        <ElementBody
          element={element}
          image={image}
          raster={raster}
          chrome={chrome}
          fontsVersion={fontsVersion}
          onMeasure={events.onMeasure}
        />
      </Group>
    </Group>
  );
}
