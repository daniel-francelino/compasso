import { Suspense, lazy } from "react";
import { checkerboard } from "@/components/shared/design/checkerboard";
import { DesignBrushCursor } from "@/components/shared/design/design-brush-cursor";
import { DesignRulers } from "@/components/shared/design/design-rulers";
import { DesignTextOverlay } from "@/components/shared/design/design-text-overlay";
import { Skeleton } from "@/components/shared/ui/skeleton";
import type { LoadedImages } from "@/hooks/shared/design/use-design-assets";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import type { DesignPaint } from "@/hooks/shared/design/use-design-paint";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignToolState } from "@/hooks/shared/design/use-design-tool";
import type { DesignViewport as ViewportState } from "@/hooks/shared/design/use-design-viewport";
import { type DrawTool, isDrawTool, selectInBox } from "@/lib/shared/design/arrange";
import { isPaintTool } from "@/lib/shared/design/paint";
import type { CanvasChrome } from "@/lib/shared/design/browser";
import type { Box } from "@/lib/shared/design/document";
import {
  DESIGN_LIMITS,
  DesignElementKind,
  DesignTool,
  type PageSize,
} from "@/lib/shared/design/types";
import type { Point } from "@/lib/shared/design/viewport";
import { cn } from "@/lib/shared/utils";

const DesignCanvas = lazy(() => import("@/components/shared/design/design-canvas"));

const CHECKER = checkerboard(16);

const CURSOR: Record<DesignTool, string> = {
  [DesignTool.Move]: "cursor-default",
  [DesignTool.Text]: "cursor-text",
  [DesignTool.Rect]: "cursor-crosshair",
  [DesignTool.Ellipse]: "cursor-crosshair",
  [DesignTool.Line]: "cursor-crosshair",
  [DesignTool.Hand]: "cursor-grab active:cursor-grabbing",
  [DesignTool.Zoom]: "cursor-zoom-in",
  [DesignTool.Marquee]: "cursor-crosshair",
  [DesignTool.Lasso]: "cursor-crosshair",
  [DesignTool.Wand]: "cursor-crosshair",
  [DesignTool.Crop]: "cursor-crosshair",
  [DesignTool.Eyedropper]: "cursor-crosshair",
  [DesignTool.Brush]: "cursor-crosshair",
  [DesignTool.Clone]: "cursor-crosshair",
  [DesignTool.Eraser]: "cursor-crosshair",
  [DesignTool.Fill]: "cursor-crosshair",
};

export function DesignViewport({
  viewport,
  tool,
  editor,
  size,
  images,
  rasters,
  chrome,
  fontsVersion,
  editable,
  label,
  rulers,
  paint,
  onDraw,
}: {
  viewport: ViewportState;
  tool: DesignToolState;
  editor: DesignEditor;
  size: PageSize;
  images: LoadedImages;
  rasters: RasterHandle;
  chrome: CanvasChrome | null;
  fontsVersion: number;
  editable: boolean;
  label: string;
  rulers: boolean;
  paint: DesignPaint;
  onDraw: (tool: DrawTool, start: Point, end: Point | null, shift: boolean) => void;
}) {
  const view = viewport.view;
  const rulerSize = rulers ? DESIGN_LIMITS.rulerSize : 0;
  const restricted = isDrawTool(tool.active) || isPaintTool(tool.active);
  const active = editable || !restricted ? tool.active : DesignTool.Move;
  const cursorTool = editable ? tool.tool : active;
  const brushDiameter =
    editable && view !== null ? paint.cursorDiameter(cursorTool, view.zoom) : null;
  const editing = editor.page.elements.find(
    (element) => element.id === tool.editingTextId && element.kind === DesignElementKind.Text,
  );

  const marquee = (box: Box, additive: boolean) => {
    const ids = selectInBox(editor.page, box);
    editor.selectMany(additive ? [...editor.selectedIds, ...ids] : ids);
  };

  const commitText = (id: string, text: string) => {
    tool.editText(null);
    if (text.trim() === "") {
      editor.remove([id]);
      return;
    }
    editor.patchText(id, { text });
  };

  return (
    <div
      className="grid min-h-0 min-w-0 flex-1 bg-muted"
      style={{
        gridTemplateColumns: `${rulerSize}px 1fr`,
        gridTemplateRows: `${rulerSize}px 1fr`,
      }}
    >
      {rulers ? (
        <>
          <div className="col-start-1 row-start-1 border-b border-r bg-card" aria-hidden="true" />
          <DesignRulers viewport={viewport} />
        </>
      ) : null}
      <div
        ref={viewport.ref}
        className={cn(
          "relative col-start-2 row-start-2 overflow-hidden",
          brushDiameter === null ? CURSOR[active] : "cursor-none",
        )}
      >
        {view === null ? null : (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute shadow-lg ring-1 ring-border"
            style={{
              ...CHECKER,
              left: view.x,
              top: view.y,
              width: size.width * view.zoom,
              height: size.height * view.zoom,
            }}
          />
        )}
        {view === null || chrome === null ? (
          <Skeleton className="absolute inset-8" />
        ) : (
          <div className="absolute inset-0">
            <Suspense fallback={<Skeleton className="absolute inset-8" />}>
              <DesignCanvas
                view={{ viewport: view, width: viewport.area.width, height: viewport.area.height }}
                tool={active}
                editingTextId={tool.editingTextId}
                page={editor.page}
                size={size}
                scale={view.zoom}
                selectedIds={editor.selectedIds}
                images={images}
                rasters={rasters}
                chrome={chrome}
                fontsVersion={fontsVersion}
                editable={editable}
                label={label}
                onSelect={editor.select}
                onCommit={editor.patchMany}
                onMeasure={editor.measure}
                onMarquee={marquee}
                onDraw={onDraw}
                onPan={viewport.pan}
                onZoom={viewport.zoomBy}
                onZoomStep={viewport.step}
                onCursor={viewport.cursor.set}
                {...(editable ? { onEditText: tool.editText, ...paint.callbacks } : {})}
              />
            </Suspense>
          </div>
        )}
        {brushDiameter === null ? null : (
          <DesignBrushCursor viewport={viewport} diameter={brushDiameter} />
        )}
        {view === null ||
        editing === undefined ||
        editing.kind !== DesignElementKind.Text ? null : (
          <DesignTextOverlay
            key={editing.id}
            element={editing}
            view={view}
            onCommit={(text) => commitText(editing.id, text)}
            onCancel={() => tool.editText(null)}
          />
        )}
      </div>
    </div>
  );
}
