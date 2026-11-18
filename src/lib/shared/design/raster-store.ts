import { createPixelBuffer, type PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

export const RASTER_BYTES_PER_PIXEL = 4;

export const rasterBytes = (width: number, height: number): number =>
  width * height * RASTER_BYTES_PER_PIXEL;

export type RasterStore = {
  get: (id: string) => PixelBuffer | undefined;
  has: (id: string) => boolean;
  ensure: (id: string, width: number, height: number) => PixelBuffer | null;
  set: (id: string, buffer: PixelBuffer) => boolean;
  release: (id: string) => void;
  ids: () => string[];
  trackDerived: (id: string, slot: string, bytes: number) => void;
  markChanged: (id: string) => void;
  revisionOf: (id: string) => number;
  dirtyIds: () => string[];
  clearDirty: (id: string) => void;
  usedBytes: () => number;
  canAllocate: (width: number, height: number) => boolean;
  subscribe: (listener: () => void) => () => void;
  snapshot: () => number;
};

export const createRasterStore = (budgetBytes = DESIGN_LIMITS.rasterBudgetBytes): RasterStore => {
  const buffers = new Map<string, PixelBuffer>();
  const revisions = new Map<string, number>();
  const dirty = new Set<string>();
  const derived = new Map<string, Map<string, number>>();
  const listeners = new Set<() => void>();
  let version = 0;
  let used = 0;

  const notify = () => {
    version += 1;
    for (const listener of listeners) listener();
  };

  const sizeOf = (id: string): number => {
    const buffer = buffers.get(id);
    return buffer === undefined ? 0 : rasterBytes(buffer.width, buffer.height);
  };

  const derivedOf = (id: string): number => {
    let total = 0;
    for (const bytes of derived.get(id)?.values() ?? []) total += bytes;
    return total;
  };

  const canReplace = (id: string, width: number, height: number): boolean =>
    used - sizeOf(id) + rasterBytes(width, height) <= budgetBytes;

  const put = (id: string, buffer: PixelBuffer): boolean => {
    if (!canReplace(id, buffer.width, buffer.height)) return false;
    used += rasterBytes(buffer.width, buffer.height) - sizeOf(id);
    buffers.set(id, buffer);
    revisions.set(id, (revisions.get(id) ?? 0) + 1);
    notify();
    return true;
  };

  return {
    get: (id) => buffers.get(id),
    has: (id) => buffers.has(id),
    ensure: (id, width, height) => {
      const existing = buffers.get(id);
      if (existing !== undefined) return existing;
      const buffer = createPixelBuffer(width, height);
      return put(id, buffer) ? buffer : null;
    },
    set: (id, buffer) => put(id, buffer),
    release: (id) => {
      if (!buffers.has(id)) return;
      used -= sizeOf(id) + derivedOf(id);
      derived.delete(id);
      buffers.delete(id);
      revisions.delete(id);
      dirty.delete(id);
      notify();
    },
    ids: () => [...buffers.keys()],
    trackDerived: (id, slot, bytes) => {
      if (!buffers.has(id)) return;
      const slots = derived.get(id) ?? new Map<string, number>();
      used += bytes - (slots.get(slot) ?? 0);
      slots.set(slot, bytes);
      derived.set(id, slots);
    },
    markChanged: (id) => {
      if (!buffers.has(id)) return;
      dirty.add(id);
      revisions.set(id, (revisions.get(id) ?? 0) + 1);
      notify();
    },
    revisionOf: (id) => revisions.get(id) ?? 0,
    dirtyIds: () => [...dirty],
    clearDirty: (id) => {
      dirty.delete(id);
    },
    usedBytes: () => used,
    canAllocate: (width, height) => used + rasterBytes(width, height) <= budgetBytes,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => version,
  };
};
