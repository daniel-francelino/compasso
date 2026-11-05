import { useCallback, useEffect, useRef, useState } from "react";

export const useTransientFlag = (durationMs: number) => {
  const [active, setActive] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const trigger = useCallback(() => {
    window.clearTimeout(timer.current);
    setActive(true);
    timer.current = window.setTimeout(() => setActive(false), durationMs);
  }, [durationMs]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return [active, trigger] as const;
};
