import { Suspense, lazy } from "react";
import { DesignRulers } from "@/components/shared/design/design-rulers";
import { DesignTextOverlay } from "@/components/shared/design/design-text-overlay";
import { Skeleton } from "@/components/shared/ui/skeleton";
import type { LoadedImages } from "@/hooks/shared/design/use-design-assets";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignToolState } from "@/hooks/shared/design/use-design-tool";
import type { DesignViewport as ViewportState } from "@/hooks/shared/design/use-design-viewport";
import { type DrawTool, isDrawTool, selectInBox } from "@/lib/shared/design/arrange";
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

const CHECKER = {
  backgroundImage: "repeating-conic-gradient(var(--line) 0% 25%, var(--surface) 0% 50%)",
  backgroundSize: "16px 16px",
};

const CURSOR: Record<DesignTool, string> = {
  [DesignTool.Move]: "cursor-default",
  [DesignTool.Text]: "cursor-text",
  [DesignTool.Rect]: "cursor-crosshair",
  [DesignTool.Ellipse]: "cursor-crosshair",
  [DesignTool.Line]: "cursor-crosshair",
  [DesignTool.Hand]: "cursor-grab active:cursor-grabbing",
  [DesignTool.Zoom]: "cursor-zoom-in",
};

export function DesignViewport({
  viewport,
  tool,
  editor,
  size,
  images,
  chrome,
  fontsVersion,
  editable,
  label,
  onDraw,
}: {
  viewport: ViewportState;
  tool: DesignToolState;
  editor: DesignEditor;
  size: PageSize;
  images: LoadedImages;
  chrome: CanvasChrome | null;
  fontsVersion: number;
  editable: boolean;
  label: string;
  onDraw: (tool: DrawTool, start: Point, end: Point | null, shift: boolean) => void;
}) {
  const view = viewport.view;
  const active = editable || !isDrawTool(tool.active) ? tool.active : DesignTool.Move;
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
        gridTemplateColumns: `${DESIGN_LIMITS.rulerSize}px 1fr`,
        gridTemplateRows: `${DESIGN_LIMITS.rulerSize}px 1fr`,
      }}
    >
      <div className="col-start-1 row-start-1 border-b border-r bg-card" aria-hidden="true" />
      <DesignRulers viewport={viewport} />
      <div
        ref={viewport.ref}
        className={cn("relative col-start-2 row-start-2 overflow-hidden", CURSOR[active])}
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
                {...(editable ? { onEditText: tool.editText } : {})}
              />
            </Suspense>
          </div>
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
