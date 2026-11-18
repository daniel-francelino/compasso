import { describe, expect, it, vi } from "vitest";
import { createRasterStore, rasterBytes } from "@/lib/shared/design/raster-store";

describe("raster store", () => {
  it("allocates an empty transparent layer once and counts its bytes", () => {
    const store = createRasterStore();
    const first = store.ensure("a", 4, 2);
    expect(first?.data.length).toBe(rasterBytes(4, 2));
    expect(store.ensure("a", 9, 9)).toBe(first);
    expect(store.usedBytes()).toBe(rasterBytes(4, 2));
  });

  it("refuses to allocate or load beyond the budget", () => {
    const store = createRasterStore(rasterBytes(4, 4));
    expect(store.ensure("a", 4, 4)).not.toBeNull();
    expect(store.ensure("b", 1, 1)).toBeNull();
    expect(store.canAllocate(1, 1)).toBe(false);
    expect(store.set("c", { width: 1, height: 1, data: new Uint8ClampedArray(4) })).toBe(false);
    store.release("a");
    expect(store.usedBytes()).toBe(0);
    expect(store.canAllocate(4, 4)).toBe(true);
  });

  it("tracks dirty layers and revisions and notifies subscribers", () => {
    const store = createRasterStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.ensure("a", 2, 2);
    const before = store.revisionOf("a");
    store.markChanged("a");
    expect(store.revisionOf("a")).toBe(before + 1);
    expect(store.dirtyIds()).toEqual(["a"]);
    store.clearDirty("a");
    expect(store.dirtyIds()).toEqual([]);
    const calls = listener.mock.calls.length;
    stop();
    store.markChanged("a");
    expect(listener.mock.calls.length).toBe(calls);
  });
});

describe("raster store derived bytes and ids", () => {
  it("counts derived bytes in the budget and frees them on release", () => {
    const store = createRasterStore();
    store.ensure("a", 4, 2);
    const base = store.usedBytes();
    store.trackDerived("a", "canvas", 100);
    store.trackDerived("a", "canvas", 60);
    expect(store.usedBytes()).toBe(base + 60);
    expect(store.ids()).toEqual(["a"]);
    store.release("a");
    expect(store.usedBytes()).toBe(0);
    expect(store.ids()).toEqual([]);
  });

  it("ignores derived bytes of unknown layers", () => {
    const store = createRasterStore();
    store.trackDerived("missing", "canvas", 100);
    expect(store.usedBytes()).toBe(0);
  });
});
