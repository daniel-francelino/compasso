import { useEffect, useState } from "react";
import { VIDEO_LIMITS } from "@/lib/shared/video/types";

export const useIsDesktop = () => {
  const [desktop, setDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${VIDEO_LIMITS.desktopMinWidth}px)`);
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return desktop;
};
