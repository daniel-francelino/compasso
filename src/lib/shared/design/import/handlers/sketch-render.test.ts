import { describe, expect, it } from "vitest";
import {
  renderShape,
  renderSize,
  renderText,
} from "@/lib/shared/design/import/handlers/sketch-render";
import { SketchNodeKind, type SketchNode } from "@/lib/shared/design/import/handlers/sketch-schema";

const node = (overrides: Partial<SketchNode>): SketchNode => ({
  kind: SketchNodeKind.Rectangle,
  id: "n",
  name: "n",
  depth: 0,
  visible: true,
  opacity: 1,
  frame: { x: 0, y: 0, width: 20, height: 20 },
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
  fill: { r: 10, g: 20, b: 30, a: 1 },
  radius: 0,
  points: [],
  closed: true,
  imageRef: null,
  text: null,
  symbolId: null,
  droppedStyles: 0,
  droppedOverrides: 0,
  ...overrides,
});

const alphaAt = (buffer: { width: number; data: Uint8ClampedArray }, x: number, y: number) =>
  buffer.data[(y * buffer.width + x) * 4 + 3];

describe("renderShape", () => {
  it("fills a plain rectangle with its color", () => {
    const buffer = renderShape(node({}));
    expect(buffer?.width).toBe(20);
    expect(Array.from(buffer?.data.slice(0, 4) ?? [])).toEqual([10, 20, 30, 255]);
    expect(alphaAt(buffer ?? { width: 0, data: new Uint8ClampedArray(0) }, 19, 19)).toBe(255);
  });

  it("rounds the corners and keeps the center", () => {
    const buffer = renderShape(node({ radius: 10 }));
    if (buffer === null) throw new Error("no pixels");
    expect(alphaAt(buffer, 0, 0)).toBe(0);
    expect(alphaAt(buffer, 10, 10)).toBe(255);
  });

  it("draws an oval with transparent corners", () => {
    const buffer = renderShape(node({ kind: SketchNodeKind.Oval }));
    if (buffer === null) throw new Error("no pixels");
    expect(alphaAt(buffer, 0, 0)).toBe(0);
    expect(alphaAt(buffer, 10, 10)).toBe(255);
  });

  it("scales alpha by the fill alpha", () => {
    const buffer = renderShape(node({ fill: { r: 0, g: 0, b: 0, a: 0.5 } }));
    expect(buffer?.data[3]).toBe(128);
  });

  it("fills a triangle path and mirrors it when flipped", () => {
    const points = [
      { x: 0, y: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, curved: false },
      { x: 1, y: 0, fromX: 1, fromY: 0, toX: 1, toY: 0, curved: false },
      { x: 0, y: 1, fromX: 0, fromY: 1, toX: 0, toY: 1, curved: false },
    ];
    const plain = renderShape(node({ kind: SketchNodeKind.Path, points }));
    const flipped = renderShape(node({ kind: SketchNodeKind.Path, points, flipHorizontal: true }));
    if (plain === null || flipped === null) throw new Error("no pixels");
    expect(alphaAt(plain, 2, 2)).toBe(255);
    expect(alphaAt(plain, 18, 18)).toBe(0);
    expect(alphaAt(flipped, 2, 6)).toBe(0);
    expect(alphaAt(flipped, 17, 2)).toBe(255);
  });

  it("returns null without a fill, for an open or tiny path and for unsupported kinds", () => {
    expect(renderShape(node({ fill: null }))).toBeNull();
    expect(renderShape(node({ kind: SketchNodeKind.Path, points: [] }))).toBeNull();
    expect(renderShape(node({ kind: SketchNodeKind.Group }))).toBeNull();
  });

  it("clamps a 10000 px frame to the page side limit and to the bound", () => {
    const wide = renderShape(
      node({ kind: SketchNodeKind.Oval, frame: { x: 0, y: 0, width: 10000, height: 3 } }),
    );
    expect([wide?.width, wide?.height]).toEqual([4096, 3]);
    expect(wide?.data.length).toBe(4096 * 3 * 4);
    const bounded = renderShape(node({ frame: { x: 0, y: 0, width: 10000, height: 50 } }), 100);
    expect([bounded?.width, bounded?.height]).toEqual([100, 50]);
    expect(renderSize(node({ frame: { x: 0, y: 0, width: 0.2, height: 0 } }), 100)).toEqual({
      width: 1,
      height: 1,
    });
  });
});

describe("renderText", () => {
  const text = { value: "Hi", font: null, size: 12, color: null };

  it("calls the painter with the frame size and skips empty text", () => {
    const calls: number[] = [];
    const painter = (_text: unknown, size: { width: number }) => {
      calls.push(size.width);
      return null;
    };
    renderText(node({ kind: SketchNodeKind.Text, text }), painter);
    renderText(node({ kind: SketchNodeKind.Text, text: { ...text, value: "  " } }), painter);
    renderText(node({ kind: SketchNodeKind.Text, text: null }), painter);
    expect(calls).toEqual([20]);
  });
});
