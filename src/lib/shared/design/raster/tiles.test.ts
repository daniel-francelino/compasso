import { describe, expect, it } from "vitest";
import { createPixelBuffer, getPixel, setPixel } from "@/lib/shared/design/raster/pixel-buffer";
import {
  TILE_SIZE,
  applyTile,
  extractTile,
  markRectDirty,
  snapshotTile,
  tileCount,
  tileFromKey,
  tileKey,
  tileRect,
  tilesEqual,
  tilesTouchedByRect,
  type TileData,
} from "@/lib/shared/design/raster/tiles";

describe("tile math", () => {
  it("uses 256 pixel tiles", () => {
    expect(TILE_SIZE).toBe(256);
    expect(tileCount(256)).toBe(1);
    expect(tileCount(257)).toBe(2);
    expect(tileCount(4096)).toBe(16);
  });

  it("round-trips keys", () => {
    expect(tileFromKey(tileKey(3, 7))).toEqual({ tx: 3, ty: 7 });
    expect(tileKey(0, 0)).not.toBe(tileKey(1, 0));
  });

  it("clips edge tiles to the buffer", () => {
    expect(tileRect(300, 300, 1, 1)).toEqual({ x: 256, y: 256, width: 44, height: 44 });
    expect(tileRect(300, 300, 5, 5).width).toBe(0);
  });

  it("lists the tiles touched by a rect", () => {
    expect(tilesTouchedByRect(1024, 1024, { x: 0, y: 0, width: 256, height: 256 })).toEqual([
      { tx: 0, ty: 0 },
    ]);
    expect(tilesTouchedByRect(1024, 1024, { x: 255, y: 255, width: 2, height: 2 })).toHaveLength(4);
    expect(tilesTouchedByRect(1024, 1024, { x: 600, y: 10, width: 10, height: 10 })).toEqual([
      { tx: 2, ty: 0 },
    ]);
  });

  it("clamps rects to the buffer and ignores empty or outside rects", () => {
    expect(
      tilesTouchedByRect(512, 512, { x: -100, y: -100, width: 1000, height: 1000 }),
    ).toHaveLength(4);
    expect(tilesTouchedByRect(512, 512, { x: 600, y: 0, width: 10, height: 10 })).toEqual([]);
    expect(tilesTouchedByRect(512, 512, { x: 10, y: 10, width: 0, height: 5 })).toEqual([]);
  });

  it("collects dirty tiles without duplicates", () => {
    const dirty = new Set<number>();
    markRectDirty(dirty, 1024, 1024, { x: 10, y: 10, width: 5, height: 5 });
    markRectDirty(dirty, 1024, 1024, { x: 20, y: 20, width: 5, height: 5 });
    markRectDirty(dirty, 1024, 1024, { x: 300, y: 10, width: 5, height: 5 });
    expect(dirty.size).toBe(2);
  });
});

describe("tile extraction", () => {
  it("extracts and applies a clipped tile exactly", () => {
    const buffer = createPixelBuffer(300, 260);
    setPixel(buffer, 299, 259, { r: 1, g: 2, b: 3, a: 4 });
    setPixel(buffer, 256, 256, { r: 9, g: 8, b: 7, a: 6 });
    const tile = extractTile(buffer, 1, 1);
    expect([tile.x, tile.y, tile.width, tile.height]).toEqual([256, 256, 44, 4]);
    expect(tile.data.length).toBe(44 * 4 * 4);
    const target = createPixelBuffer(300, 260);
    applyTile(target, tile);
    expect(getPixel(target, 299, 259)).toEqual({ r: 1, g: 2, b: 3, a: 4 });
    expect(getPixel(target, 256, 256)).toEqual({ r: 9, g: 8, b: 7, a: 6 });
  });

  it("snapshots a tile once and keeps the first copy", () => {
    const buffer = createPixelBuffer(256, 256);
    const store = new Map<number, TileData>();
    const first = snapshotTile(buffer, store, 0, 0);
    setPixel(buffer, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
    const second = snapshotTile(buffer, store, 0, 0);
    expect(second).toBe(first);
    expect(first.data[0]).toBe(0);
  });

  it("compares tile data", () => {
    expect(tilesEqual(Uint8ClampedArray.of(1, 2), Uint8ClampedArray.of(1, 2))).toBe(true);
    expect(tilesEqual(Uint8ClampedArray.of(1, 2), Uint8ClampedArray.of(1, 3))).toBe(false);
    expect(tilesEqual(Uint8ClampedArray.of(1), Uint8ClampedArray.of(1, 2))).toBe(false);
  });
});
