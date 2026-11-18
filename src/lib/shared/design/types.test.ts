import { describe, expect, it } from "vitest";
import {
  DESIGN_BLEND_MODE_LABEL,
  DESIGN_ENABLED_TOOLS,
  DESIGN_SHAPE_KEY,
  DESIGN_SHORTCUT_HELP,
  DESIGN_TOOL_KEY,
  DESIGN_TOOL_LABEL,
  DesignToolGroup,
  DesignBlendMode,
  DesignTool,
  isShapeTool,
  nextShapeTool,
  visibleToolGroups,
} from "@/lib/shared/design/types";

describe("shortcut table", () => {
  it("has a label and a key for every enabled tool", () => {
    for (const tool of DESIGN_ENABLED_TOOLS) {
      expect(DESIGN_TOOL_LABEL[tool]).not.toBe("");
      expect(DESIGN_TOOL_KEY[tool]).toHaveLength(1);
    }
  });

  it("has no duplicate keys among enabled tools, except the shape group sharing its key", () => {
    const keys = DESIGN_ENABLED_TOOLS.filter((tool) => !isShapeTool(tool)).map(
      (tool) => DESIGN_TOOL_KEY[tool],
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain(DESIGN_SHAPE_KEY);
    for (const tool of DESIGN_ENABLED_TOOLS.filter(isShapeTool)) {
      expect(DESIGN_TOOL_KEY[tool]).toBe(DESIGN_SHAPE_KEY);
    }
  });

  it("uses Photoshop keys and keeps future tools out of the enabled list", () => {
    expect(DESIGN_TOOL_KEY[DesignTool.Move]).toBe("v");
    expect(DESIGN_TOOL_KEY[DesignTool.Eyedropper]).toBe("i");
    expect(DESIGN_TOOL_KEY[DesignTool.Brush]).toBe("b");
    expect(DESIGN_ENABLED_TOOLS).toContain(DesignTool.Brush);
    expect(DESIGN_ENABLED_TOOLS).not.toContain(DesignTool.Clone);
  });

  it("cycles the shape tools rect, ellipse, line", () => {
    expect(nextShapeTool(DesignTool.Rect)).toBe(DesignTool.Ellipse);
    expect(nextShapeTool(DesignTool.Ellipse)).toBe(DesignTool.Line);
    expect(nextShapeTool(DesignTool.Line)).toBe(DesignTool.Rect);
  });

  it("lists the shortcuts for the popover", () => {
    expect(DESIGN_SHORTCUT_HELP.some(([keys]) => keys === "Ctrl+Shift+K")).toBe(true);
  });
});

describe("blend modes", () => {
  it("has a label for each of the sixteen modes", () => {
    expect(Object.values(DesignBlendMode)).toHaveLength(16);
    for (const mode of Object.values(DesignBlendMode)) {
      expect(DESIGN_BLEND_MODE_LABEL[mode]).not.toBe("");
    }
  });
});

describe("tool groups", () => {
  it("lists only enabled tools and drops empty groups", () => {
    const groups = visibleToolGroups(DESIGN_ENABLED_TOOLS);
    expect(groups.map((item) => item.group)).toEqual([
      DesignToolGroup.Move,
      DesignToolGroup.Selection,
      DesignToolGroup.Eyedropper,
      DesignToolGroup.Paint,
      DesignToolGroup.Text,
      DesignToolGroup.Shapes,
      DesignToolGroup.Hand,
      DesignToolGroup.Zoom,
    ]);
    const shapes = groups.find((item) => item.group === DesignToolGroup.Shapes);
    expect(shapes?.tools).toEqual([DesignTool.Rect, DesignTool.Ellipse, DesignTool.Line]);
  });

  it("shows a future tool in its group once it is enabled", () => {
    const groups = visibleToolGroups([...DESIGN_ENABLED_TOOLS, DesignTool.Clone]);
    const paint = groups.find((item) => item.group === DesignToolGroup.Paint);
    expect(paint?.tools).toEqual([DesignTool.Brush, DesignTool.Eraser, DesignTool.Clone]);
  });

  it("places every tool in exactly one group", () => {
    const all = visibleToolGroups(Object.values(DesignTool)).flatMap((item) => item.tools);
    expect([...all].sort()).toEqual([...Object.values(DesignTool)].sort());
  });
});
