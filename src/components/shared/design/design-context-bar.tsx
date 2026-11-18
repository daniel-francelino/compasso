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
import {
  BrushOptionsBar,
  EyedropperOptionsBar,
} from "@/components/shared/design/design-paint-options";
import {
  LassoOptions,
  MarqueeOptions,
  WandOptions,
} from "@/components/shared/design/design-selection-options";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignPaint } from "@/hooks/shared/design/use-design-paint";
import type { SelectionController } from "@/hooks/shared/design/use-design-selection";
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
  [DesignTool.Marquee]: MarqueeOptions,
  [DesignTool.Lasso]: LassoOptions,
  [DesignTool.Wand]: WandOptions,
  [DesignTool.Crop]: UnavailableOptions,
  [DesignTool.Eyedropper]: EyedropperOptionsBar,
  [DesignTool.Brush]: BrushOptionsBar,
  [DesignTool.Clone]: UnavailableOptions,
  [DesignTool.Eraser]: BrushOptionsBar,
  [DesignTool.Fill]: UnavailableOptions,
};

export function DesignContextBar({
  editor,
  viewport,
  tool,
  size,
  paint,
  selection,
}: {
  editor: DesignEditor;
  viewport: DesignViewport;
  tool: DesignTool;
  size: PageSize;
  paint: DesignPaint;
  selection: SelectionController;
}) {
  const Options = DESIGN_TOOL_OPTIONS[tool];
  return (
    <div
      role="toolbar"
      aria-label="Opções da ferramenta"
      className="flex min-h-12 shrink-0 items-center gap-1 overflow-x-auto border-b bg-card px-3"
    >
      <Options
        editor={editor}
        viewport={viewport}
        size={size}
        paint={paint}
        selection={selection}
        tool={tool}
      />
    </div>
  );
}
