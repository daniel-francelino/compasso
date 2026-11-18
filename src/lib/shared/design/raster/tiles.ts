import { at } from "@/lib/shared/design/raster/numeric";
import type { PixelBuffer, Rect } from "@/lib/shared/design/raster/pixel-buffer";

export const TILE_SIZE = 256;

const TILE_KEY_STRIDE = 65536;

export type TileCoord = { tx: number; ty: number };

export type TileData = {
  key: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type DirtyTiles = Set<number>;

export const tileKey = (tx: number, ty: number): number => ty * TILE_KEY_STRIDE + tx;

export const tileFromKey = (key: number): TileCoord => ({
  tx: key % TILE_KEY_STRIDE,
  ty: Math.floor(key / TILE_KEY_STRIDE),
});

export const tileCount = (size: number): number => Math.ceil(size / TILE_SIZE);

export const tileRect = (width: number, height: number, tx: number, ty: number): Rect => {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  return {
    x,
    y,
    width: Math.max(0, Math.min(TILE_SIZE, width - x)),
    height: Math.max(0, Math.min(TILE_SIZE, height - y)),
  };
};

export const tilesTouchedByRect = (width: number, height: number, rect: Rect): TileCoord[] => {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(height, Math.ceil(rect.y + rect.height));
  if (x1 <= x0 || y1 <= y0) return [];
  const tiles: TileCoord[] = [];
  for (let ty = Math.floor(y0 / TILE_SIZE); ty <= Math.floor((y1 - 1) / TILE_SIZE); ty += 1) {
    for (let tx = Math.floor(x0 / TILE_SIZE); tx <= Math.floor((x1 - 1) / TILE_SIZE); tx += 1) {
      tiles.push({ tx, ty });
    }
  }
  return tiles;
};

export const markRectDirty = (
  dirty: DirtyTiles,
  width: number,
  height: number,
  rect: Rect,
): void => {
  for (const { tx, ty } of tilesTouchedByRect(width, height, rect)) dirty.add(tileKey(tx, ty));
};

export const extractTile = (buffer: PixelBuffer, tx: number, ty: number): TileData => {
  const rect = tileRect(buffer.width, buffer.height, tx, ty);
  const data = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * buffer.width + rect.x) * 4;
    data.set(buffer.data.subarray(start, start + rect.width * 4), row * rect.width * 4);
  }
  return {
    key: tileKey(tx, ty),
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    data,
  };
};

export const applyTile = (
  buffer: PixelBuffer,
  tile: Pick<TileData, "x" | "y" | "width" | "height" | "data">,
): void => {
  for (let row = 0; row < tile.height; row += 1) {
    const start = ((tile.y + row) * buffer.width + tile.x) * 4;
    buffer.data.set(tile.data.subarray(row * tile.width * 4, (row + 1) * tile.width * 4), start);
  }
};

export const snapshotTile = (
  buffer: PixelBuffer,
  store: Map<number, TileData>,
  tx: number,
  ty: number,
): TileData => {
  const key = tileKey(tx, ty);
  const existing = store.get(key);
  if (existing !== undefined) return existing;
  const tile = extractTile(buffer, tx, ty);
  store.set(key, tile);
  return tile;
};

export const snapshotRect = (
  buffer: PixelBuffer,
  store: Map<number, TileData>,
  rect: Rect,
): void => {
  for (const { tx, ty } of tilesTouchedByRect(buffer.width, buffer.height, rect)) {
    snapshotTile(buffer, store, tx, ty);
  }
};

export const tilesEqual = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (at(a, i) !== at(b, i)) return false;
  }
  return true;
};
