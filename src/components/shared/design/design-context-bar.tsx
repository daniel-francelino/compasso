import type { ComponentType } from "react";
import { CropOptions, TransformOptions } from "@/components/shared/design/design-crop-options";
import {
  HandOptions,
  MoveOptions,
  ShapeOptions,
  TextOptions,
  type ToolOptionsProps,
  ZoomOptions,
} from "@/components/shared/design/design-tool-options";
import {
  BucketOptionsBar,
  GradientOptionsBar,
} from "@/components/shared/design/design-fill-options";
import { CloneOptionsBar, ToneOptionsBar } from "@/components/shared/design/design-retouch-options";
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
import type { CropController } from "@/hooks/shared/design/use-design-crop";
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
  [DesignTool.Crop]: CropOptions,
  [DesignTool.Eyedropper]: EyedropperOptionsBar,
  [DesignTool.Brush]: BrushOptionsBar,
  [DesignTool.Clone]: CloneOptionsBar,
  [DesignTool.Dodge]: ToneOptionsBar,
  [DesignTool.Burn]: ToneOptionsBar,
  [DesignTool.Eraser]: BrushOptionsBar,
  [DesignTool.Fill]: BucketOptionsBar,
  [DesignTool.Gradient]: GradientOptionsBar,
};

export function DesignContextBar({
  editor,
  viewport,
  tool,
  size,
  paint,
  selection,
  crop,
}: {
  editor: DesignEditor;
  viewport: DesignViewport;
  tool: DesignTool;
  size: PageSize;
  paint: DesignPaint;
  selection: SelectionController;
  crop: CropController;
}) {
  const Options = DESIGN_TOOL_OPTIONS[tool];
  return (
    <div
      role="toolbar"
      aria-label="Opções da ferramenta"
      className="flex min-h-12 shrink-0 items-center gap-1 overflow-x-auto border-b bg-card px-3"
    >
      {editor.transforming ? (
        <TransformOptions editor={editor} />
      ) : (
        <Options
          editor={editor}
          viewport={viewport}
          size={size}
          paint={paint}
          selection={selection}
          crop={crop}
          tool={tool}
        />
      )}
    </div>
  );
}
