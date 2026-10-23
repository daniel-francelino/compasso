import type { BrowserStorage } from "@/lib/shared/storage/types";

export const browserStorage = (): BrowserStorage => ({
  upload(target, body, contentType, onProgress) {
    return new Promise<boolean>((resolve) => {
      const request = new XMLHttpRequest();
      request.open("PUT", target.url);
      request.setRequestHeader("Content-Type", contentType);
      request.upload.onprogress = (event) => {
        if (onProgress && event.lengthComputable) onProgress(event.loaded / event.total);
      };
      request.onload = () => resolve(request.status >= 200 && request.status < 300);
      request.onerror = () => resolve(false);
      request.onabort = () => resolve(false);
      request.send(body);
    });
  },
});
