import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFeedMemory, saveFeedMemory } from "@/hooks/portal/use-feed-memory";
import { StoredKey } from "@/lib/shared/stored-keys";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("feed memory", () => {
  it("returns nothing for a brand that was never stored", () => {
    expect(readFeedMemory("brand-a")).toBeUndefined();
  });

  it("keeps the filter and the first post per brand", () => {
    saveFeedMemory("brand-a", { status: "pending", anchorId: "post-7" });
    saveFeedMemory("brand-b", { status: "all", anchorId: null });
    expect(readFeedMemory("brand-a")).toEqual({ status: "pending", anchorId: "post-7" });
    expect(readFeedMemory("brand-b")).toEqual({ status: "all", anchorId: null });
  });

  it("ignores a stored value with the wrong shape", () => {
    store.set(StoredKey.PortalFeed, JSON.stringify({ "brand-a": { status: 3 } }));
    expect(readFeedMemory("brand-a")).toBeUndefined();
  });
});
