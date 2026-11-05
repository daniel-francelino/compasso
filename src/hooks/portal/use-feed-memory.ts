import { useMemo } from "react";
import { z } from "zod";
import { StoredKey, readStored, writeStored } from "@/lib/shared/stored-keys";

const memorySchema = z.record(
  z.string(),
  z.object({ status: z.string(), anchorId: z.string().nullable() }),
);

export type FeedMemory = { status: string; anchorId: string | null };

export const readFeedMemory = (brandId: string): FeedMemory | undefined =>
  readStored(StoredKey.PortalFeed, memorySchema, {})[brandId];

export const saveFeedMemory = (brandId: string, memory: FeedMemory): void => {
  const all = readStored(StoredKey.PortalFeed, memorySchema, {});
  writeStored(StoredKey.PortalFeed, { ...all, [brandId]: memory });
};

export const useFeedMemory = (brandId: string) =>
  useMemo(
    () => ({
      read: () => readFeedMemory(brandId),
      save: (memory: FeedMemory) => saveFeedMemory(brandId, memory),
    }),
    [brandId],
  );
