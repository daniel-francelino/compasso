import type { z } from "zod";
import { logError } from "@/lib/shared/logger";
import type { ValueOf } from "@/lib/shared/utils";

export const StoredKey = {
  CalendarView: "compasso:calendar-view",
  CalendarRange: "compasso:calendar-range",
  SidebarOpen: "compasso:sidebar-open",
  LastSpace: "compasso:last-space",
  ListColumns: "compasso:list-columns",
  ApprovalDraftComment: "compasso:approval-draft-comment",
} as const;
export type StoredKey = ValueOf<typeof StoredKey>;

export type StorageArea = "local" | "session";

const areaOf = (storage: StorageArea) =>
  storage === "local" ? window.localStorage : window.sessionStorage;

export function readStored<T>(
  key: StoredKey,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  fallback: T,
  storage: StorageArea = "local",
): T {
  try {
    const raw = areaOf(storage).getItem(key);
    if (raw === null) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: StoredKey, value: unknown, storage: StorageArea = "local") {
  try {
    const area = areaOf(storage);
    if (value === null) area.removeItem(key);
    else area.setItem(key, JSON.stringify(value));
  } catch (error) {
    logError("could not write browser storage", error);
  }
}
