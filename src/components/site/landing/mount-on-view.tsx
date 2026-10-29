import { type UseInViewOptions, useInView } from "motion/react";
import { type ReactNode, useRef } from "react";

export function MountOnView({
  children,
  margin = "300px",
}: {
  children: ReactNode;
  margin?: UseInViewOptions["margin"];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin });
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {near ? children : null}
    </div>
  );
}
