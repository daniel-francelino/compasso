import type { BrowserStorage, BrowserUploadResult } from "@/lib/shared/storage/types";

export const browserStorage = (): BrowserStorage => ({
  upload(target, body, contentType, onProgress) {
    return new Promise<BrowserUploadResult>((resolve) => {
      const request = new XMLHttpRequest();
      request.open("PUT", target.url);
      request.setRequestHeader("Content-Type", contentType);
      request.upload.onprogress = (event) => {
        if (onProgress && event.lengthComputable) onProgress(event.loaded / event.total);
      };
      request.onload = () =>
        resolve(
          request.status >= 200 && request.status < 300
            ? { ok: true }
            : { ok: false, status: request.status },
        );
      request.onerror = () => resolve({ ok: false, status: 0 });
      request.onabort = () => resolve({ ok: false, status: 0 });
      request.send(body);
    });
  },
});
