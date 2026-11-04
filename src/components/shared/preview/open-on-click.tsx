import type { MouseEvent, ReactNode } from "react";

const INTERACTIVE = "button, a, input, textarea, select, video, audio, [role=tab], [role=button]";

export function OpenOnClick({
  onOpen,
  children,
}: {
  onOpen: (() => void) | undefined;
  children: ReactNode;
}) {
  function openFromClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest(INTERACTIVE) !== null) return;
    onOpen?.();
  }

  return (
    <div
      className={onOpen ? "cursor-pointer" : undefined}
      onClick={onOpen ? openFromClick : undefined}
    >
      {children}
    </div>
  );
}
