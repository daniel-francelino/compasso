import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import {
  applyTile,
  extractTile,
  tileCount,
  tileKey,
  tileFromKey,
  tilesEqual,
  type TileData,
} from "@/lib/shared/design/raster/tiles";

export const DEFAULT_PIXEL_HISTORY_BUDGET_BYTES = 256 * 1024 * 1024;
export const MAX_PIXEL_HISTORY_STEPS = 100;

export type TilePatch = {
  key: number;
  x: number;
  y: number;
  width: number;
  height: number;
  before: Uint8ClampedArray;
  after: Uint8ClampedArray;
};

export type PixelPatch = { tiles: TilePatch[]; bytes: number };

export type PixelHistoryStep = {
  id: string;
  label: string;
  targetId: string;
  bytes: number;
  applied: boolean;
};

export type PixelHistoryOptions = { budgetBytes?: number; maxSteps?: number };

export type PixelHistory = {
  push: (label: string, targetId: string, patch: PixelPatch, id?: string) => number;
  undo: (resolve: (targetId: string) => PixelBuffer | null, id?: string) => string | null;
  redo: (resolve: (targetId: string) => PixelBuffer | null, id?: string) => string | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  bytes: () => number;
  size: () => number;
  steps: () => PixelHistoryStep[];
  clear: () => void;
};

export const patchBytes = (tiles: readonly TilePatch[]): number =>
  tiles.reduce((total, tile) => total + tile.before.byteLength + tile.after.byteLength, 0);

export const recordStroke = (
  before: ReadonlyMap<number, TileData>,
  buffer: PixelBuffer,
): PixelPatch => {
  const tiles: TilePatch[] = [];
  for (const [key, snapshot] of before) {
    const { tx, ty } = tileFromKey(key);
    const after = extractTile(buffer, tx, ty);
    if (tilesEqual(snapshot.data, after.data)) continue;
    tiles.push({
      key,
      x: snapshot.x,
      y: snapshot.y,
      width: snapshot.width,
      height: snapshot.height,
      before: snapshot.data,
      after: after.data,
    });
  }
  return { tiles, bytes: patchBytes(tiles) };
};

export const recordReplace = (before: PixelBuffer, after: PixelBuffer): PixelPatch | null => {
  if (before.width !== after.width || before.height !== after.height) return null;
  const snapshots = new Map<number, TileData>();
  for (let ty = 0; ty < tileCount(before.height); ty += 1) {
    for (let tx = 0; tx < tileCount(before.width); tx += 1) {
      snapshots.set(tileKey(tx, ty), extractTile(before, tx, ty));
    }
  }
  const patch = recordStroke(snapshots, after);
  return patch.tiles.length === 0 ? null : patch;
};

export const applyPatch = (buffer: PixelBuffer, patch: PixelPatch): void => {
  for (const tile of patch.tiles) applyTile(buffer, { ...tile, data: tile.after });
};

export const revertPatch = (buffer: PixelBuffer, patch: PixelPatch): void => {
  for (const tile of patch.tiles) applyTile(buffer, { ...tile, data: tile.before });
};

type StoredStep = { id: string; label: string; targetId: string; patch: PixelPatch };

export const createPixelHistory = (options: PixelHistoryOptions = {}): PixelHistory => {
  const budget = options.budgetBytes ?? DEFAULT_PIXEL_HISTORY_BUDGET_BYTES;
  const maxSteps = options.maxSteps ?? MAX_PIXEL_HISTORY_STEPS;
  let steps: StoredStep[] = [];
  let cursor = 0;
  let total = 0;

  const evict = (): number => {
    let evicted = 0;
    while (steps.length > 1 && (steps.length > maxSteps || total > budget)) {
      const oldest = steps.shift();
      total -= oldest?.patch.bytes ?? 0;
      cursor -= 1;
      evicted += 1;
    }
    return evicted;
  };

  const push = (label: string, targetId: string, patch: PixelPatch, id = ""): number => {
    for (const dropped of steps.slice(cursor)) total -= dropped.patch.bytes;
    steps = steps.slice(0, cursor);
    steps.push({ id, label, targetId, patch });
    total += patch.bytes;
    cursor = steps.length;
    return evict();
  };

  const undo = (resolve: (targetId: string) => PixelBuffer | null, id?: string): string | null => {
    const step = steps[cursor - 1];
    if (step === undefined || (id !== undefined && step.id !== id)) return null;
    const buffer = resolve(step.targetId);
    if (buffer === null) return null;
    revertPatch(buffer, step.patch);
    cursor -= 1;
    return step.label;
  };

  const redo = (resolve: (targetId: string) => PixelBuffer | null, id?: string): string | null => {
    const step = steps[cursor];
    if (step === undefined || (id !== undefined && step.id !== id)) return null;
    const buffer = resolve(step.targetId);
    if (buffer === null) return null;
    applyPatch(buffer, step.patch);
    cursor += 1;
    return step.label;
  };

  return {
    push,
    undo,
    redo,
    canUndo: () => cursor > 0,
    canRedo: () => cursor < steps.length,
    bytes: () => total,
    size: () => steps.length,
    steps: () =>
      steps.map((step, index) => ({
        id: step.id,
        label: step.label,
        targetId: step.targetId,
        bytes: step.patch.bytes,
        applied: index < cursor,
      })),
    clear: () => {
      steps = [];
      cursor = 0;
      total = 0;
    },
  };
};
