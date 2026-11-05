import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFeedMemory, saveFeedMemory } from "@/hooks/portal/use-feed-memory";

const store = new Map<string, unknown>();

vi.mock("@/lib/shared/stored-keys", () => ({
  StoredKey: { PortalFeed: "aura:portal-feed" },
  readStored: (
    key: string,
    schema: { safeParse: (value: unknown) => { success: boolean; data?: unknown } },
    fallback: unknown,
  ) => {
    const parsed = schema.safeParse(store.get(key));
    return parsed.success ? parsed.data : fallback;
  },
  writeStored: (key: string, value: unknown) => void store.set(key, value),
}));

beforeEach(() => {
  store.clear();
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
    store.set("aura:portal-feed", { "brand-a": { status: 3 } });
    expect(readFeedMemory("brand-a")).toBeUndefined();
  });
});
