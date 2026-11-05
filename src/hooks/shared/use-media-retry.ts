import { useRef, useState } from "react";
import type { PreviewMedia } from "@/components/shared/preview/media-slide";

export const useMediaRetry = (item: PreviewMedia) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const retried = useRef(false);
  const failed = item.url !== null && failedUrl === item.url;

  const onError = () => {
    const url = item.url;
    if (url === null) return;
    if (item.refresh === undefined || retried.current) {
      setFailedUrl(url);
      return;
    }
    retried.current = true;
    void item.refresh().then((fresh) => {
      const next = fresh?.[item.versionId];
      if (next === undefined || next === url) setFailedUrl(url);
    });
  };
  const onLoad = () => {
    retried.current = false;
  };

  return { failed, onError, onLoad };
};
