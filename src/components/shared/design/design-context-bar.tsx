import type { ComponentType } from "react";
import {
  HandOptions,
  MoveOptions,
  ShapeOptions,
  TextOptions,
  type ToolOptionsProps,
  UnavailableOptions,
  ZoomOptions,
} from "@/components/shared/design/design-tool-options";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignViewport } from "@/hooks/shared/design/use-design-viewport";
import { DesignTool, type PageSize } from "@/lib/shared/design/types";

const DESIGN_TOOL_OPTIONS: Record<DesignTool, ComponentType<ToolOptionsProps>> = {
  [DesignTool.Move]: MoveOptions,
  [DesignTool.Text]: TextOptions,
  [DesignTool.Rect]: ShapeOptions,
  [DesignTool.Ellipse]: ShapeOptions,
  [DesignTool.Line]: ShapeOptions,
  [DesignTool.Hand]: HandOptions,
  [DesignTool.Zoom]: ZoomOptions,
  [DesignTool.Marquee]: UnavailableOptions,
  [DesignTool.Lasso]: UnavailableOptions,
  [DesignTool.Wand]: UnavailableOptions,
  [DesignTool.Crop]: UnavailableOptions,
  [DesignTool.Eyedropper]: UnavailableOptions,
  [DesignTool.Brush]: UnavailableOptions,
  [DesignTool.Clone]: UnavailableOptions,
  [DesignTool.Eraser]: UnavailableOptions,
  [DesignTool.Fill]: UnavailableOptions,
};

export function DesignContextBar({
  editor,
  viewport,
  tool,
  size,
}: {
  editor: DesignEditor;
  viewport: DesignViewport;
  tool: DesignTool;
  size: PageSize;
}) {
  const Options = DESIGN_TOOL_OPTIONS[tool];
  return (
    <div
      role="toolbar"
      aria-label="Opções da ferramenta"
      className="flex min-h-12 shrink-0 items-center gap-1 overflow-x-auto border-b bg-card px-3"
    >
      <Options editor={editor} viewport={viewport} size={size} />
    </div>
  );
}
