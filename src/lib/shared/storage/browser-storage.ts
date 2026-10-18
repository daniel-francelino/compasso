import type { BrowserStorage } from "@/lib/shared/storage/types";

export const browserStorage = (): BrowserStorage => ({
  async upload(target, body, contentType) {
    try {
      const response = await fetch(target.url, {
        method: "PUT",
        body,
        headers: { "Content-Type": contentType },
      });
      return response.ok;
    } catch {
      return false;
    }
  },
});
