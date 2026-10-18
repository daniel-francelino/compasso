import { r2Config } from "@/lib/shared/env.server";
import { r2ServerStorage } from "@/lib/shared/storage/r2-storage.server";
import type { ServerStorage } from "@/lib/shared/storage/types";

export const serverStorage = (): ServerStorage | null => {
  const config = r2Config();
  return config === null ? null : r2ServerStorage(config);
};
